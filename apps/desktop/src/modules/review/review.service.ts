import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createLogger } from '@gitchorus/shared';
import type {
  Logger,
  ValidationStep,
  ReviewResult,
  ReviewQueueItem,
  ReviewStatus,
} from '@gitchorus/shared';
import { GithubService } from '../git/github.service';
import { ProviderRegistry } from '../provider/provider.registry';
import { ReviewHistoryService } from './review-history.service';

/**
 * Internal event names for EventEmitter2 communication
 * between ReviewService and ReviewGateway.
 */
export const InternalReviewEvents = {
  PROGRESS: 'internal.review.progress',
  COMPLETE: 'internal.review.complete',
  ERROR: 'internal.review.error',
  QUEUE_UPDATE: 'internal.review.queue-update',
} as const;

/**
 * Orchestrates PR review via the AI provider layer.
 *
 * Manages a queue of review requests that process sequentially.
 * Emits events via EventEmitter2 for the gateway to broadcast via WebSocket.
 */
@Injectable()
export class ReviewService {
  /** Queue of reviews indexed by PR number */
  private reviewQueue = new Map<number, ReviewQueueItem>();

  /** Currently running review PR number */
  private currentReview: number | null = null;

  /** Project path for the current session */
  private projectPath: string | null = null;

  /** Logger instance */
  private readonly logger: Logger;

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly githubService: GithubService,
    private readonly eventEmitter: EventEmitter2,
    private readonly historyService: ReviewHistoryService
  ) {
    this.logger = createLogger('ReviewService');
  }

  /**
   * Queue a review for the given PR number.
   * If nothing is currently running, starts processing immediately.
   */
  queueReview(prNumber: number, projectPath: string): void {
    this.projectPath = projectPath;

    // If already in queue or running, skip
    const existing = this.reviewQueue.get(prNumber);
    if (existing && (existing.status === 'queued' || existing.status === 'running')) {
      this.logger.info(`PR #${prNumber} already ${existing.status}, skipping`);
      return;
    }

    const queueItem: ReviewQueueItem = {
      prNumber,
      status: 'queued',
      queuedAt: new Date().toISOString(),
    };

    this.reviewQueue.set(prNumber, queueItem);
    this.logger.info(`Queued review for PR #${prNumber}`);
    this.emitQueueUpdate();

    // If nothing is running, start processing
    if (this.currentReview === null) {
      this.processQueue();
    }
  }

  /**
   * Cancel a review. If running, aborts via the provider's cancel method.
   * If queued, removes from queue.
   */
  cancelReview(prNumber: number): void {
    const item = this.reviewQueue.get(prNumber);
    if (!item) return;

    if (item.status === 'running') {
      this.logger.info(`Cancelling running review for PR #${prNumber}`);
      const provider = this.providerRegistry.getClaude();
      if (provider) {
        provider.cancel();
      }
    } else if (item.status === 'queued') {
      this.logger.info(`Removing queued review for PR #${prNumber}`);
      this.updateQueueItem(prNumber, {
        status: 'cancelled',
        completedAt: new Date().toISOString(),
      });
    }

    this.emitQueueUpdate();
  }

  /**
   * Get the current queue state as an array.
   */
  getQueue(): ReviewQueueItem[] {
    return Array.from(this.reviewQueue.values());
  }

  /**
   * Process the next item in the queue.
   */
  private async processQueue(): Promise<void> {
    // Find the next queued item
    const nextItem = Array.from(this.reviewQueue.values()).find(item => item.status === 'queued');

    if (!nextItem || !this.projectPath) {
      this.currentReview = null;
      return;
    }

    this.currentReview = nextItem.prNumber;

    try {
      await this.runReview(nextItem.prNumber, this.projectPath);
    } catch (error) {
      this.logger.error(`Unexpected error in processQueue for PR #${nextItem.prNumber}:`, error);
    }

    // Process next item in queue
    this.currentReview = null;
    this.processQueue();
  }

  /**
   * Run a single review using the AI provider.
   */
  private async runReview(prNumber: number, projectPath: string): Promise<void> {
    // Update status to running
    this.updateQueueItem(prNumber, {
      status: 'running',
      startedAt: new Date().toISOString(),
    });
    this.emitQueueUpdate();

    try {
      // Fetch PR details
      const pr = await this.githubService.getPullRequest(projectPath, prNumber);
      if (!pr) {
        throw new Error(`PR #${prNumber} not found`);
      }

      // Fetch diff
      const diff = await this.githubService.getPrDiff(projectPath, prNumber);
      if (!diff) {
        throw new Error(`Could not fetch diff for PR #${prNumber}`);
      }

      // Get repo info for repoName
      const repoInfo = await this.githubService.getRepoInfo(projectPath);
      const repoName = repoInfo?.fullName || 'unknown/unknown';

      // Get the Claude provider
      const provider = this.providerRegistry.getClaude();
      if (!provider) {
        throw new Error('Claude provider is not available');
      }

      // Run the review generator
      const generator = provider.review({
        diff,
        prNumber,
        prTitle: pr.title,
        prBody: pr.body,
        headBranch: pr.headRefName,
        baseBranch: pr.baseRefName,
        repoPath: projectPath,
        repoName,
      });

      let result: ReviewResult | undefined;

      // Iterate over the async generator
      while (true) {
        const { value, done } = await generator.next();

        if (done) {
          result = value as ReviewResult;
          break;
        }

        // value is a ValidationStep -- emit progress
        const step = value as ValidationStep;
        this.eventEmitter.emit(InternalReviewEvents.PROGRESS, {
          prNumber,
          step,
        });
      }

      if (!result) {
        throw new Error('Review completed without producing a result');
      }

      // Save to history for local persistence
      this.historyService.save(result);

      // Update queue item with result
      this.updateQueueItem(prNumber, {
        status: 'completed',
        result,
        completedAt: new Date().toISOString(),
      });

      // Emit completion
      this.eventEmitter.emit(InternalReviewEvents.COMPLETE, {
        prNumber,
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isCancelled = errorMessage.includes('cancelled') || errorMessage.includes('aborted');

      const status: ReviewStatus = isCancelled ? 'cancelled' : 'failed';

      this.updateQueueItem(prNumber, {
        status,
        error: errorMessage,
        completedAt: new Date().toISOString(),
      });

      this.eventEmitter.emit(InternalReviewEvents.ERROR, {
        prNumber,
        error: errorMessage,
      });
    } finally {
      this.emitQueueUpdate();
    }
  }

  /**
   * Update a queue item's fields.
   */
  private updateQueueItem(prNumber: number, updates: Partial<ReviewQueueItem>): void {
    const existing = this.reviewQueue.get(prNumber);
    if (existing) {
      this.reviewQueue.set(prNumber, { ...existing, ...updates });
    }
  }

  /**
   * Emit queue state update via EventEmitter2.
   */
  private emitQueueUpdate(): void {
    this.eventEmitter.emit(InternalReviewEvents.QUEUE_UPDATE, {
      queue: this.getQueue(),
    });
  }
}
