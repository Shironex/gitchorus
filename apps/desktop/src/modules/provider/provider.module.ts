import { Module, OnModuleInit } from '@nestjs/common';
import { createLogger } from '@gitchorus/shared';
import { CodexAgentProvider } from './codex-agent.provider';
import { ProviderRegistry } from './provider.registry';
import { SettingsModule } from '../settings';

const logger = createLogger('ProviderModule');

/**
 * NestJS module that manages AI providers.
 *
 * Registers the CodexAgentProvider with the ProviderRegistry
 * during module initialization. The registry and provider are
 * exported for use by other modules (e.g., ValidationModule).
 */
@Module({
  imports: [SettingsModule],
  providers: [CodexAgentProvider, ProviderRegistry],
  exports: [CodexAgentProvider, ProviderRegistry],
})
export class ProviderModule implements OnModuleInit {
  constructor(
    private readonly codexProvider: CodexAgentProvider,
    private readonly registry: ProviderRegistry
  ) {}

  onModuleInit(): void {
    logger.info('Initializing provider module');
    this.registry.register('codex', this.codexProvider);
    logger.info('Provider module initialized');
  }
}
