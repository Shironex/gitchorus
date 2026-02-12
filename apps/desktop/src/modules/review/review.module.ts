import { Module } from '@nestjs/common';
import { GitModule } from '../git';
import { ProviderModule } from '../provider';
import { ReviewService } from './review.service';
import { ReviewGateway } from './review.gateway';
import { ReviewHistoryService } from './review-history.service';

/**
 * NestJS module for PR review.
 *
 * Imports GitModule (for GithubService) and ProviderModule (for ProviderRegistry).
 * Provides ReviewService for queue management and agent dispatch,
 * ReviewHistoryService for local persistence via electron-store,
 * and ReviewGateway for WebSocket event handling.
 */
@Module({
  imports: [GitModule, ProviderModule],
  providers: [ReviewService, ReviewGateway, ReviewHistoryService],
  exports: [ReviewService, ReviewHistoryService],
})
export class ReviewModule {}
