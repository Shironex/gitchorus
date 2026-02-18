import { Injectable } from '@nestjs/common';
import type { ProviderType, ProviderStatus } from '@gitchorus/shared';
import { createLogger } from '@gitchorus/shared';
import type { CodexAgentProvider } from './codex-agent.provider';

const logger = createLogger('ProviderRegistry');

/**
 * Provider-like interface that matches what CodexAgentProvider exposes.
 * We use this instead of BaseProvider directly because NestJS Injectable
 * services cannot implement interfaces with AsyncGenerator methods cleanly.
 */
interface ProviderLike {
  getStatus(): Promise<ProviderStatus>;
}

/**
 * Registry that manages all available AI providers.
 *
 * Providers register themselves during module initialization.
 * The registry provides a unified way to query provider statuses
 * and retrieve specific providers by type.
 */
@Injectable()
export class ProviderRegistry {
  private providers = new Map<ProviderType, ProviderLike>();

  /**
   * Register a provider with the registry.
   */
  register(type: ProviderType, provider: ProviderLike): void {
    logger.info(`Registering provider: ${type}`);
    this.providers.set(type, provider);
  }

  /**
   * Get a specific provider by type.
   */
  get(type: ProviderType): ProviderLike | undefined {
    return this.providers.get(type);
  }

  /**
   * Get the Codex agent provider specifically (typed).
   */
  getCodex(): CodexAgentProvider | undefined {
    return this.providers.get('codex') as CodexAgentProvider | undefined;
  }

  /**
   * Get all registered provider types.
   */
  getAll(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get status of all registered providers.
   */
  async getStatuses(): Promise<ProviderStatus[]> {
    const statuses: ProviderStatus[] = [];

    for (const [type, provider] of this.providers) {
      try {
        const status = await provider.getStatus();
        statuses.push(status);
      } catch (error) {
        logger.error(`Failed to get status for provider ${type}:`, error);
        statuses.push({
          type,
          available: false,
          authenticated: false,
          error: `Failed to check status: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return statuses;
  }
}
