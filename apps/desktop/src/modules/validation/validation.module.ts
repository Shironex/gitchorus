import { Module } from '@nestjs/common';
import { GitModule } from '../git';
import { ProviderModule } from '../provider';
import { ValidationService } from './validation.service';
import { ValidationGateway } from './validation.gateway';
import { ValidationHistoryService } from './validation-history.service';

/**
 * NestJS module for issue validation.
 *
 * Imports GitModule (for GithubService) and ProviderModule (for ProviderRegistry).
 * Provides ValidationService for queue management and agent dispatch,
 * ValidationHistoryService for local persistence via electron-store,
 * and ValidationGateway for WebSocket event handling.
 */
@Module({
  imports: [GitModule, ProviderModule],
  providers: [ValidationService, ValidationGateway, ValidationHistoryService],
  exports: [ValidationService, ValidationHistoryService],
})
export class ValidationModule {}
