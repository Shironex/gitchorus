import { Module, OnModuleInit } from '@nestjs/common';
import { createLogger } from '@gitchorus/shared';
import { ClaudeAgentProvider } from './claude-agent.provider';
import { ProviderRegistry } from './provider.registry';
import { SettingsModule } from '../settings';

const logger = createLogger('ProviderModule');

/**
 * NestJS module that manages AI providers.
 *
 * Registers the ClaudeAgentProvider with the ProviderRegistry
 * during module initialization. The registry and provider are
 * exported for use by other modules (e.g., ValidationModule).
 */
@Module({
  imports: [SettingsModule],
  providers: [ClaudeAgentProvider, ProviderRegistry],
  exports: [ClaudeAgentProvider, ProviderRegistry],
})
export class ProviderModule implements OnModuleInit {
  constructor(
    private readonly claudeProvider: ClaudeAgentProvider,
    private readonly registry: ProviderRegistry
  ) {}

  onModuleInit(): void {
    logger.info('Initializing provider module');
    this.registry.register('claude', this.claudeProvider);
    logger.info('Provider module initialized');
  }
}
