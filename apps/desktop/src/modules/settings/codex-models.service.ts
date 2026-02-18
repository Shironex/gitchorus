import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import * as readline from 'readline';
import {
  createLogger,
  DEFAULT_CODEX_MODEL_OPTIONS,
  type CodexModelOption,
} from '@gitchorus/shared';
import { findCodexCli } from '../../main/utils';

const logger = createLogger('CodexModelsService');
const MODEL_CACHE_TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

interface CachedModels {
  models: CodexModelOption[];
  cachedAt: number;
}

interface JsonRpcResponse<T = unknown> {
  id?: number;
  result?: T;
  error?: { message?: string };
}

interface AppServerModelListResponse {
  data?: unknown[];
}

@Injectable()
export class CodexModelsService {
  private cache: CachedModels | null = null;
  private inFlightRefresh: Promise<CachedModels> | null = null;

  async getModels(forceRefresh = false): Promise<{ models: CodexModelOption[]; cachedAt: string }> {
    const cached = this.cache;
    if (!forceRefresh && cached && Date.now() - cached.cachedAt < MODEL_CACHE_TTL_MS) {
      return {
        models: cached.models,
        cachedAt: new Date(cached.cachedAt).toISOString(),
      };
    }

    if (!this.inFlightRefresh) {
      this.inFlightRefresh = this.refreshModels();
    }

    try {
      const refreshed = await this.inFlightRefresh;
      return {
        models: refreshed.models,
        cachedAt: new Date(refreshed.cachedAt).toISOString(),
      };
    } finally {
      this.inFlightRefresh = null;
    }
  }

  private async refreshModels(): Promise<CachedModels> {
    try {
      const detection = await findCodexCli();
      if (!detection.cliPath) {
        logger.debug('Codex CLI not found, returning fallback model list');
        return this.setFallbackCache();
      }

      const discovered = await this.fetchModelsFromAppServer(detection.cliPath);
      if (discovered.length === 0) {
        logger.warn('Codex app-server returned no models, using fallback list');
        return this.setFallbackCache();
      }

      const next: CachedModels = {
        models: discovered,
        cachedAt: Date.now(),
      };
      this.cache = next;

      logger.info(`Discovered ${discovered.length} Codex models from app-server`);
      return next;
    } catch (error) {
      logger.warn('Failed to refresh Codex models, using cached/fallback list:', error);

      if (this.cache) {
        return this.cache;
      }

      return this.setFallbackCache();
    }
  }

  private setFallbackCache(): CachedModels {
    const fallback: CachedModels = {
      models: DEFAULT_CODEX_MODEL_OPTIONS.map(model => ({ ...model })),
      cachedAt: Date.now(),
    };
    this.cache = fallback;
    return fallback;
  }

  private async fetchModelsFromAppServer(cliPath: string): Promise<CodexModelOption[]> {
    const result = await this.executeJsonRpc<AppServerModelListResponse>(cliPath, 'model/list', {});
    if (!result || !Array.isArray(result.data)) {
      return [];
    }

    const unique = new Map<string, CodexModelOption>();

    for (const raw of result.data) {
      const model = this.toModelOption(raw);
      if (!model || unique.has(model.id)) continue;
      unique.set(model.id, model);
    }

    return Array.from(unique.values());
  }

  private toModelOption(raw: unknown): CodexModelOption | null {
    if (!raw || typeof raw !== 'object') return null;

    const entry = raw as Record<string, unknown>;
    const fromModel = typeof entry.model === 'string' ? entry.model.trim() : '';
    const fromId = typeof entry.id === 'string' ? entry.id.trim() : '';
    const id = fromModel || fromId;
    if (!id) return null;

    const label =
      typeof entry.displayName === 'string' && entry.displayName.trim()
        ? entry.displayName.trim()
        : id;

    const description =
      typeof entry.description === 'string' && entry.description.trim()
        ? entry.description.trim()
        : undefined;

    const isDefault = typeof entry.isDefault === 'boolean' ? entry.isDefault : false;

    return { id, label, description, isDefault };
  }

  private async executeJsonRpc<T>(
    cliPath: string,
    method: string,
    params: unknown
  ): Promise<T | null> {
    const needsShell = process.platform === 'win32' && cliPath.toLowerCase().endsWith('.cmd');
    const child = spawn(cliPath, ['app-server'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TERM: 'dumb',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: needsShell,
    });

    if (!child.stdin || !child.stdout || !child.stderr) {
      child.kill('SIGTERM');
      throw new Error('Failed to open stdio pipes for Codex app-server');
    }

    const rl = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    let settled = false;
    let requestId = 0;
    const stderrChunks: string[] = [];

    const pending = new Map<
      number,
      {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
      }
    >();

    const clearPending = () => {
      for (const p of pending.values()) {
        clearTimeout(p.timeout);
      }
      pending.clear();
    };

    const finish = () => {
      clearPending();
      rl.close();
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    };

    const sendRequest = <R>(requestMethod: string, requestParams?: unknown): Promise<R> =>
      new Promise<R>((resolve, reject) => {
        if (settled) {
          reject(new Error('Codex app-server request attempted after completion'));
          return;
        }

        const id = ++requestId;
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Codex app-server request timed out: ${requestMethod}`));
        }, REQUEST_TIMEOUT_MS);

        pending.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
          timeout,
        });

        child.stdin!.write(
          JSON.stringify({
            id,
            method: requestMethod,
            params: requestParams ?? {},
          }) + '\n'
        );
      });

    const sendNotification = (notificationMethod: string, notificationParams?: unknown) => {
      if (settled) return;
      const payload = notificationParams
        ? { method: notificationMethod, params: notificationParams }
        : { method: notificationMethod };
      child.stdin!.write(JSON.stringify(payload) + '\n');
    };

    rl.on('line', line => {
      if (!line.trim()) return;

      try {
        const message = JSON.parse(line) as JsonRpcResponse;
        if (typeof message.id !== 'number') return;

        const p = pending.get(message.id);
        if (!p) return;

        clearTimeout(p.timeout);
        pending.delete(message.id);

        if (message.error) {
          p.reject(new Error(message.error.message || 'Unknown JSON-RPC error'));
          return;
        }

        p.resolve(message.result);
      } catch {
        // Ignore non-JSON lines.
      }
    });

    child.stderr.on('data', chunk => {
      stderrChunks.push(String(chunk));
    });

    const exitPromise = new Promise<never>((_, reject) => {
      child.on('error', error => {
        if (settled) return;
        settled = true;
        finish();
        reject(error);
      });

      child.on('exit', code => {
        if (settled) return;
        settled = true;
        finish();
        const stderr = stderrChunks.join('').trim();
        reject(
          new Error(
            stderr
              ? `Codex app-server exited (code=${code ?? 'unknown'}): ${stderr}`
              : `Codex app-server exited before completing request (code=${code ?? 'unknown'})`
          )
        );
      });
    });

    const runPromise = (async (): Promise<T | null> => {
      try {
        await sendRequest('initialize', {
          clientInfo: {
            name: 'gitchorus',
            title: 'GitChorus',
            version: '0.6.1',
          },
        });

        sendNotification('initialized');

        const result = await sendRequest<T>(method, params);
        if (settled) return null;
        settled = true;
        finish();
        return result;
      } catch (error) {
        if (settled) return null;
        settled = true;
        finish();
        throw error;
      }
    })();

    return Promise.race([runPromise, exitPromise]);
  }
}
