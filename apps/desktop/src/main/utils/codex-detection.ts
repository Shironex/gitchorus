import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { CodexCliStatus } from '@gitchorus/shared';
import { createLogger } from '@gitchorus/shared';
import { joinPaths, getHomeDir, isWindows } from './path';
import { findCliInPath, findCliInLocalPaths, type CliDetectionResult } from './cli-detection';

const logger = createLogger('CodexDetection');
const execFileAsync = promisify(execFile);

/**
 * Get Codex config directory (~/.codex).
 */
export function getCodexConfigDir(): string {
  return joinPaths(getHomeDir(), '.codex');
}

/**
 * Get common Codex CLI installation paths (cross-platform).
 */
export function getCodexCliPaths(): string[] {
  const home = getHomeDir();

  if (isWindows()) {
    const appData = process.env['APPDATA'] || joinPaths(home, 'AppData/Roaming');
    const localAppData = process.env['LOCALAPPDATA'] || joinPaths(home, 'AppData/Local');
    return [
      joinPaths(home, '.local/bin/codex.exe'),
      joinPaths(appData, 'npm/codex.cmd'),
      joinPaths(appData, 'npm/codex'),
      joinPaths(localAppData, 'Programs/codex/codex.exe'),
    ];
  }

  return [
    joinPaths(home, '.local/bin/codex'),
    '/usr/local/bin/codex',
    '/opt/homebrew/bin/codex',
    joinPaths(home, '.npm-global/bin/codex'),
  ];
}

/**
 * Find Codex CLI installation.
 */
export async function findCodexCli(): Promise<CliDetectionResult> {
  const pathResult = await findCliInPath('codex');
  if (pathResult) {
    return { cliPath: pathResult, method: 'path' };
  }

  const localPath = findCliInLocalPaths(getCodexCliPaths());
  if (localPath) {
    return { cliPath: localPath, method: 'local' };
  }

  return { method: 'none' };
}

/**
 * Get Codex CLI version.
 */
export async function getCodexCliVersion(cliPath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(cliPath, ['--version']);
    return stdout.trim();
  } catch (error) {
    logger.debug('Failed to get Codex CLI version:', error);
    return undefined;
  }
}

/**
 * Check Codex CLI authentication status.
 * Uses `codex login status`, which exits successfully regardless of state.
 */
export async function checkCodexAuth(cliPath: string): Promise<{ authenticated: boolean }> {
  try {
    const { stdout, stderr } = await execFileAsync(cliPath, ['login', 'status']);
    const output = `${stdout}\n${stderr}`.toLowerCase();
    if (/\bnot\s+logged\s+in\b/.test(output) || /\blogged\s*out\b/.test(output)) {
      return { authenticated: false };
    }

    return {
      authenticated: /\blogged\s+in\b/.test(output),
    };
  } catch (error) {
    logger.debug('Failed to check Codex auth status:', error);
    return { authenticated: false };
  }
}

/**
 * Get full Codex CLI status.
 */
export async function getCodexCliStatus(): Promise<CodexCliStatus> {
  const platform = process.platform;
  const arch = process.arch;

  const { cliPath, method } = await findCodexCli();
  const version = cliPath ? await getCodexCliVersion(cliPath) : undefined;
  const auth = cliPath ? await checkCodexAuth(cliPath) : { authenticated: false };

  return {
    installed: !!cliPath,
    path: cliPath,
    version,
    method: method === 'none' ? undefined : method,
    platform,
    arch,
    auth,
  };
}

/**
 * Fast existence check for bundled Codex config (best-effort diagnostics).
 */
export function hasCodexConfigDir(): boolean {
  return existsSync(getCodexConfigDir());
}
