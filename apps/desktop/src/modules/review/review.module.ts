import { Module } from '@nestjs/common';
import { GitModule } from '../git';
import { ProviderModule } from '../provider';
import { ReviewService } from './review.service';
import { ReviewGateway } from './review.gateway';

/**
 * NestJS module for PR review.
 *
 * Imports GitModule (for GithubService) and ProviderModule (for ProviderRegistry).
 * Provides ReviewService for queue management and agent dispatch,
 * and ReviewGateway for WebSocket event handling.
 */
@Module({
  imports: [GitModule, ProviderModule],
  providers: [ReviewService, ReviewGateway],
  exports: [ReviewService],
})
export class ReviewModule {}
