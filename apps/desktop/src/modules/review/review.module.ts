import { Module } from '@nestjs/common';
import { GitModule } from '../git';
import { ProviderModule } from '../provider';
import { ReviewService } from './review.service';
import { ReviewGateway } from './review.gateway';
import { ReviewHistoryService } from './review-history.service';
import { ReviewLogService } from './review-log.service';

/**
 * NestJS module for PR review.
 *
 * Imports GitModule (for GithubService) and ProviderModule (for ProviderRegistry).
 * Review execution is handled in the provider layer, matching the pattern where
 * ValidationModule does not import SettingsModule.
 * Provides ReviewService for queue management and agent dispatch,
 * ReviewHistoryService for local persistence via electron-store,
 * ReviewLogService for JSONL file logging,
 * and ReviewGateway for WebSocket event handling.
 */
@Module({
  imports: [GitModule, ProviderModule],
  providers: [ReviewService, ReviewGateway, ReviewHistoryService, ReviewLogService],
  exports: [ReviewService, ReviewHistoryService, ReviewLogService],
})
export class ReviewModule {}
