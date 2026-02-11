import { Module } from '@nestjs/common';
import { GitModule } from '../git';
import { ProviderModule } from '../provider';
import { ValidationService } from './validation.service';
import { ValidationGateway } from './validation.gateway';

/**
 * NestJS module for issue validation.
 *
 * Imports GitModule (for GithubService) and ProviderModule (for ProviderRegistry).
 * Provides ValidationService for queue management and agent dispatch,
 * and ValidationGateway for WebSocket event handling.
 */
@Module({
  imports: [GitModule, ProviderModule],
  providers: [ValidationService, ValidationGateway],
  exports: [ValidationService],
})
export class ValidationModule {}
