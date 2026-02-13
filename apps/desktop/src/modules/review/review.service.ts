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
import { ReviewLogService } from './review-log.service';

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

  /** Tracks previousReviewId for re-review queue items (keyed by prNumber) */
  private reReviewContext = new Map<number, string>();

  /** Logger with file transport for troubleshooting */
  private readonly logger: Logger;

  /** File transport function for passing to providers */
  private readonly fileTransport: (message: string) => void;

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly githubService: GithubService,
    private readonly eventEmitter: EventEmitter2,
    private readonly historyService: ReviewHistoryService,
    private readonly logService: ReviewLogService
  ) {
    this.fileTransport = this.logService.getLogTransport();
    this.logger = createLogger('ReviewService', { fileTransport: this.fileTransport });
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
   * Queue a re-review for the given PR number with context from a previous review.
   * The previous review's findings and score are passed to the AI for fair score progression.
   */
  queueReReview(prNumber: number, projectPath: string, previousReviewId: string): void {
    this.reReviewContext.set(prNumber, previousReviewId);
    this.queueReview(prNumber, projectPath);
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
    const startTime = Date.now();

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

      // Fetch HEAD commit SHA for chain tracking
      let headCommitSha: string | undefined;
      try {
        headCommitSha = await this.githubService.getPrHeadSha(projectPath, prNumber);
      } catch (error) {
        this.logger.warn(`Failed to get HEAD SHA for PR #${prNumber}:`, error);
      }

      // Get the Claude provider
      const provider = this.providerRegistry.getClaude();
      if (!provider) {
        throw new Error('Claude provider is not available');
      }

      // Build review params — enriched with re-review context if available
      const previousReviewId = this.reReviewContext.get(prNumber);
      const reviewParams: import('@gitchorus/shared').ReviewParams = {
        diff,
        prNumber,
        prTitle: pr.title,
        prBody: pr.body,
        headBranch: pr.headRefName,
        baseBranch: pr.baseRefName,
        repoPath: projectPath,
        repoName,
        fileTransport: this.fileTransport,
      };

      if (previousReviewId) {
        const previousEntry = this.historyService.getById(previousReviewId);
        if (previousEntry) {
          reviewParams.isReReview = true;
          reviewParams.previousReview = previousEntry;
          reviewParams.previousHeadCommitSha = previousEntry.headCommitSha;

          // Get incremental diff if we have both SHAs
          if (previousEntry.headCommitSha && headCommitSha) {
            try {
              reviewParams.incrementalDiff = await this.githubService.getCommitDiff(
                projectPath,
                previousEntry.headCommitSha,
                headCommitSha
              );
              this.logger.info(
                `Got incremental diff for PR #${prNumber}: ${previousEntry.headCommitSha.slice(0, 7)}..${headCommitSha.slice(0, 7)}`
              );
            } catch (error) {
              this.logger.warn(
                `Failed to get incremental diff for PR #${prNumber}, will use full diff only:`,
                error
              );
            }
          }
        } else {
          this.logger.warn(
            `Previous review ${previousReviewId} not found in history, running as initial review`
          );
        }

        // Clean up re-review context
        this.reReviewContext.delete(prNumber);
      }

      // Run the review generator
      const generator = provider.review(reviewParams);

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

      // Enrich result with chain metadata
      if (headCommitSha) {
        result.headCommitSha = headCommitSha;
      }
      if (previousReviewId) {
        const previousEntry = this.historyService.getById(previousReviewId);
        result.previousReviewId = previousReviewId;
        result.isReReview = true;
        if (previousEntry) {
          result.previousScore = previousEntry.qualityScore;
          // Calculate sequence from previous entry
          result.reviewSequence = (previousEntry.reviewSequence || 1) + 1;
        }
      } else {
        result.reviewSequence = 1;
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
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isCancelled = errorMessage.includes('cancelled') || errorMessage.includes('aborted');

      // Log full error to file logger for post-mortem debugging
      this.logger.error(
        `Review failed for PR #${prNumber} (duration=${durationMs}ms): ${errorMessage}`
      );
      if (error instanceof Error && error.stack) {
        this.logger.debug(`Stack trace: ${error.stack}`);
      }

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
