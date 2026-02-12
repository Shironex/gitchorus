import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createLogger } from '@gitchorus/shared';
import type {
  Logger,
  ValidationStep,
  ValidationResult,
  ValidationQueueItem,
  ValidationStatus,
} from '@gitchorus/shared';
import { GithubService } from '../git/github.service';
import { ProviderRegistry } from '../provider/provider.registry';
import { ValidationHistoryService } from './validation-history.service';
import { ValidationLogService } from './validation-log.service';

/**
 * Internal event names for EventEmitter2 communication
 * between ValidationService and ValidationGateway.
 */
export const InternalValidationEvents = {
  PROGRESS: 'internal.validation.progress',
  COMPLETE: 'internal.validation.complete',
  ERROR: 'internal.validation.error',
  QUEUE_UPDATE: 'internal.validation.queue-update',
} as const;

/**
 * Orchestrates issue validation via the AI provider layer.
 *
 * Manages a queue of validation requests that process sequentially.
 * Emits events via EventEmitter2 for the gateway to broadcast via WebSocket.
 */
@Injectable()
export class ValidationService {
  /** Queue of validations indexed by issue number */
  private validationQueue = new Map<number, ValidationQueueItem>();

  /** Currently running validation issue number */
  private currentValidation: number | null = null;

  /** AbortController for the currently running validation */
  private abortController: AbortController | null = null;

  /** Project path for the current session */
  private projectPath: string | null = null;

  /** Logger with file transport for troubleshooting */
  private readonly logger: Logger;

  /** File transport function for passing to providers */
  private readonly fileTransport: (message: string) => void;

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly githubService: GithubService,
    private readonly eventEmitter: EventEmitter2,
    private readonly historyService: ValidationHistoryService,
    private readonly logService: ValidationLogService
  ) {
    this.fileTransport = this.logService.getLogTransport();
    this.logger = createLogger('ValidationService', { fileTransport: this.fileTransport });
  }

  /**
   * Queue a validation for the given issue number.
   * If nothing is currently running, starts processing immediately.
   */
  queueValidation(issueNumber: number, projectPath: string): void {
    this.projectPath = projectPath;

    // If already in queue or running, skip
    const existing = this.validationQueue.get(issueNumber);
    if (existing && (existing.status === 'queued' || existing.status === 'running')) {
      this.logger.info(`Issue #${issueNumber} already ${existing.status}, skipping`);
      return;
    }

    const queueItem: ValidationQueueItem = {
      issueNumber,
      status: 'queued',
      queuedAt: new Date().toISOString(),
    };

    this.validationQueue.set(issueNumber, queueItem);
    this.logger.info(`Queued validation for issue #${issueNumber}`);
    this.emitQueueUpdate();

    // If nothing is running, start processing
    if (this.currentValidation === null) {
      this.processQueue();
    }
  }

  /**
   * Cancel a validation. If running, aborts via AbortController.
   * If queued, removes from queue.
   */
  cancelValidation(issueNumber: number): void {
    const item = this.validationQueue.get(issueNumber);
    if (!item) return;

    if (item.status === 'running' && this.abortController) {
      this.logger.info(`Cancelling running validation for issue #${issueNumber}`);
      this.abortController.abort();
    } else if (item.status === 'queued') {
      this.logger.info(`Removing queued validation for issue #${issueNumber}`);
      this.updateQueueItem(issueNumber, {
        status: 'cancelled',
        completedAt: new Date().toISOString(),
      });
    }

    this.emitQueueUpdate();
  }

  /**
   * Get the current queue state as an array.
   */
  getQueue(): ValidationQueueItem[] {
    return Array.from(this.validationQueue.values());
  }

  /**
   * Process the next item in the queue.
   */
  private async processQueue(): Promise<void> {
    // Find the next queued item
    const nextItem = Array.from(this.validationQueue.values()).find(
      item => item.status === 'queued'
    );

    if (!nextItem || !this.projectPath) {
      this.currentValidation = null;
      return;
    }

    this.currentValidation = nextItem.issueNumber;

    try {
      await this.runValidation(nextItem.issueNumber, this.projectPath);
    } catch (error) {
      // Error handling is done inside runValidation
      this.logger.error(`Unexpected error in processQueue for #${nextItem.issueNumber}:`, error);
    }

    // Process next item in queue
    this.currentValidation = null;
    this.processQueue();
  }

  /**
   * Run a single validation using the AI provider.
   */
  private async runValidation(issueNumber: number, projectPath: string): Promise<void> {
    // Update status to running
    this.updateQueueItem(issueNumber, {
      status: 'running',
      startedAt: new Date().toISOString(),
    });
    this.emitQueueUpdate();

    try {
      // Fetch issue details
      const issue = await this.githubService.getIssue(projectPath, issueNumber);
      if (!issue) {
        throw new Error(`Issue #${issueNumber} not found`);
      }

      // Get repo info for repoName
      const repoInfo = await this.githubService.getRepoInfo(projectPath);
      const repoName = repoInfo?.fullName || 'unknown/unknown';

      // Get the Claude provider
      const provider = this.providerRegistry.getClaude();
      if (!provider) {
        throw new Error('Claude provider is not available');
      }

      // Create abort controller
      this.abortController = new AbortController();

      // Run the validation generator — pass fileTransport for log file writing
      const generator = provider.validate({
        issue,
        repoPath: projectPath,
        repoName,
        fileTransport: this.fileTransport,
      });

      let result: ValidationResult | undefined;

      // Iterate over the async generator
      while (true) {
        const { value, done } = await generator.next();

        if (done) {
          // The return value is the ValidationResult
          result = value as ValidationResult;
          break;
        }

        // value is a ValidationStep — emit progress
        const step = value as ValidationStep;
        this.eventEmitter.emit(InternalValidationEvents.PROGRESS, {
          issueNumber,
          step,
        });
      }

      if (!result) {
        throw new Error('Validation completed without producing a result');
      }

      // Save to history for local persistence
      this.historyService.save(result);

      // Update queue item with result
      this.updateQueueItem(issueNumber, {
        status: 'completed',
        result,
        completedAt: new Date().toISOString(),
      });

      // Emit completion
      this.eventEmitter.emit(InternalValidationEvents.COMPLETE, {
        issueNumber,
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isCancelled = errorMessage.includes('cancelled') || errorMessage.includes('aborted');

      const status: ValidationStatus = isCancelled ? 'cancelled' : 'failed';

      this.updateQueueItem(issueNumber, {
        status,
        error: errorMessage,
        completedAt: new Date().toISOString(),
      });

      this.eventEmitter.emit(InternalValidationEvents.ERROR, {
        issueNumber,
        error: errorMessage,
      });
    } finally {
      this.abortController = null;
      this.emitQueueUpdate();
    }
  }

  /**
   * Update a queue item's fields.
   */
  private updateQueueItem(issueNumber: number, updates: Partial<ValidationQueueItem>): void {
    const existing = this.validationQueue.get(issueNumber);
    if (existing) {
      this.validationQueue.set(issueNumber, { ...existing, ...updates });
    }
  }

  /**
   * Emit queue state update via EventEmitter2.
   */
  private emitQueueUpdate(): void {
    this.eventEmitter.emit(InternalValidationEvents.QUEUE_UPDATE, {
      queue: this.getQueue(),
    });
  }
}
