import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReviewService, InternalReviewEvents } from './review.service';
import { ReviewHistoryService } from './review-history.service';
import { ReviewLogService } from './review-log.service';
import { ProviderRegistry } from '../provider/provider.registry';
import { GithubService } from '../git/github.service';
import type { ReviewResult, ReviewHistoryEntry } from '@gitchorus/shared';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockResult(overrides: Partial<ReviewResult> = {}): ReviewResult {
  return {
    prNumber: 42,
    prTitle: 'Test PR',
    repositoryFullName: 'user/repo',
    findings: [],
    verdict: 'Looks good',
    qualityScore: 8,
    reviewedAt: new Date().toISOString(),
    providerType: 'claude',
    model: 'claude-sonnet-4-5-20250929',
    costUsd: 0.01,
    durationMs: 5000,
    ...overrides,
  };
}

function createMockHistoryEntry(overrides: Partial<ReviewHistoryEntry> = {}): ReviewHistoryEntry {
  return {
    ...createMockResult(),
    id: 'rh-42-prev',
    ...overrides,
  };
}

/**
 * Create an async generator that yields steps then returns a result.
 */
async function* createMockGenerator(result: ReviewResult) {
  yield { step: '1', message: 'Analyzing...', timestamp: new Date().toISOString() };
  return result;
}

// ---------------------------------------------------------------------------
// Service mocks
// ---------------------------------------------------------------------------

const mockProvider = {
  reviewAuto: jest.fn(),
  cancel: jest.fn(),
};

const mockProviderRegistry = {
  getClaude: jest.fn().mockReturnValue(mockProvider),
};

const mockGithubService = {
  getPullRequest: jest.fn(),
  getPrDiff: jest.fn(),
  getRepoInfo: jest.fn(),
  getPrHeadSha: jest.fn(),
  getCommitDiff: jest.fn(),
};

const mockHistoryService = {
  save: jest.fn(),
  getById: jest.fn(),
  getReviewChain: jest.fn(),
  list: jest.fn(),
  getLatestForPR: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

const mockLogService = {
  getLogTransport: jest.fn().mockReturnValue(() => {}),
  getLogEntries: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReviewService', () => {
  let service: ReviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: ProviderRegistry, useValue: mockProviderRegistry },
        { provide: GithubService, useValue: mockGithubService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: ReviewHistoryService, useValue: mockHistoryService },
        { provide: ReviewLogService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);

    // Default mock responses
    mockGithubService.getPullRequest.mockResolvedValue({
      number: 42,
      title: 'Test PR',
      body: 'Description',
      headRefName: 'feature',
      baseRefName: 'main',
    });
    mockGithubService.getPrDiff.mockResolvedValue('diff --git a/file.ts b/file.ts\n+added');
    mockGithubService.getRepoInfo.mockResolvedValue({ fullName: 'user/repo' });
    mockGithubService.getPrHeadSha.mockResolvedValue('abc123');
    mockHistoryService.save.mockImplementation((result: ReviewResult) => ({
      ...result,
      id: 'rh-42-saved',
    }));
  });

  // ========================================================================
  // queueReview
  // ========================================================================

  describe('queueReview', () => {
    it('should add a review to the queue and emit queue update', () => {
      service.queueReview(42, '/repo');

      const queue = service.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].prNumber).toBe(42);
      // Status may be 'queued' or 'running' since processQueue fires immediately
      expect(['queued', 'running']).toContain(queue[0].status);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        InternalReviewEvents.QUEUE_UPDATE,
        expect.objectContaining({ queue: expect.any(Array) })
      );
    });

    it('should skip duplicate queued review for same PR', () => {
      service.queueReview(42, '/repo');

      // Reset emit count to track only the second call
      mockEventEmitter.emit.mockClear();
      service.queueReview(42, '/repo');

      // Should not emit another queue update since it's a skip
      expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
        InternalReviewEvents.QUEUE_UPDATE,
        expect.anything()
      );
    });

    it('should allow queueing different PRs', () => {
      // Mock review to not start processing (provider returns generator)
      const neverResolve = new Promise(() => {});
      mockProvider.reviewAuto.mockReturnValue({
        next: () => neverResolve,
      });

      service.queueReview(42, '/repo');
      service.queueReview(43, '/repo');

      const queue = service.getQueue();
      expect(queue).toHaveLength(2);
    });
  });

  // ========================================================================
  // queueReReview
  // ========================================================================

  describe('queueReReview', () => {
    it('should store re-review context and delegate to queueReview', () => {
      const queueReviewSpy = jest.spyOn(service, 'queueReview');

      service.queueReReview(42, '/repo', 'rh-42-prev');

      expect(queueReviewSpy).toHaveBeenCalledWith(42, '/repo');
    });
  });

  // ========================================================================
  // cancelReview
  // ========================================================================

  describe('cancelReview', () => {
    it('should do nothing when PR is not in queue', () => {
      service.cancelReview(999);

      // No error, no queue update
      expect(mockProvider.cancel).not.toHaveBeenCalled();
    });

    it('should mark queued review as cancelled', () => {
      // Queue a review but prevent processing
      const neverResolve = new Promise(() => {});
      mockProvider.reviewAuto.mockReturnValue({
        next: () => neverResolve,
      });

      service.queueReview(42, '/repo');
      service.queueReview(43, '/repo');

      service.cancelReview(43);

      const queue = service.getQueue();
      const item43 = queue.find(q => q.prNumber === 43);
      expect(item43?.status).toBe('cancelled');
    });
  });

  // ========================================================================
  // runReview (integration — tested through queueReview)
  // ========================================================================

  describe('runReview (via queueReview)', () => {
    it('should run review and emit progress + complete events', async () => {
      const result = createMockResult();
      mockProvider.reviewAuto.mockReturnValue(createMockGenerator(result));

      service.queueReview(42, '/repo');

      // Allow the async queue processing to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should emit progress events
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        InternalReviewEvents.PROGRESS,
        expect.objectContaining({
          prNumber: 42,
          step: expect.objectContaining({ message: 'Analyzing...' }),
        })
      );

      // Should emit complete event
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        InternalReviewEvents.COMPLETE,
        expect.objectContaining({
          prNumber: 42,
          result: expect.objectContaining({ qualityScore: 8 }),
        })
      );

      // Should save to history
      expect(mockHistoryService.save).toHaveBeenCalled();
    });

    it('should enrich result with headCommitSha and reviewSequence for initial review', async () => {
      const result = createMockResult();
      mockProvider.reviewAuto.mockReturnValue(createMockGenerator(result));

      service.queueReview(42, '/repo');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check the result passed to history save
      const savedResult = mockHistoryService.save.mock.calls[0][0] as ReviewResult;
      expect(savedResult.headCommitSha).toBe('abc123');
      expect(savedResult.reviewSequence).toBe(1);
      expect(savedResult.isReReview).toBeUndefined();
      expect(savedResult.previousReviewId).toBeUndefined();
    });

    it('should enrich result with re-review metadata for re-review', async () => {
      const previousEntry = createMockHistoryEntry({
        prNumber: 42,
        qualityScore: 6,
        headCommitSha: 'prev-sha',
        reviewSequence: 1,
      });
      mockHistoryService.getById.mockReturnValue(previousEntry);
      mockGithubService.getCommitDiff.mockResolvedValue('incremental diff content');

      const result = createMockResult({ qualityScore: 8 });
      mockProvider.reviewAuto.mockReturnValue(createMockGenerator(result));

      service.queueReReview(42, '/repo', 'rh-42-prev');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check provider was called with re-review params
      const reviewParams = mockProvider.reviewAuto.mock.calls[0][0];
      expect(reviewParams.isReReview).toBe(true);
      expect(reviewParams.previousReview).toEqual(previousEntry);
      expect(reviewParams.incrementalDiff).toBe('incremental diff content');

      // Check the result was enriched
      const savedResult = mockHistoryService.save.mock.calls[0][0] as ReviewResult;
      expect(savedResult.previousReviewId).toBe('rh-42-prev');
      expect(savedResult.isReReview).toBe(true);
      expect(savedResult.previousScore).toBe(6);
      expect(savedResult.reviewSequence).toBe(2);
    });

    it('should fallback to initial review when previous review is not found', async () => {
      mockHistoryService.getById.mockReturnValue(null);

      const result = createMockResult();
      mockProvider.reviewAuto.mockReturnValue(createMockGenerator(result));

      service.queueReReview(42, '/repo', 'nonexistent-id');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should still have run the review (as initial — no isReReview on params)
      const reviewParams = mockProvider.reviewAuto.mock.calls[0][0];
      expect(reviewParams.isReReview).toBeUndefined();

      // Should still complete with initial review metadata
      expect(mockHistoryService.save).toHaveBeenCalled();
      const savedResult = mockHistoryService.save.mock.calls[0][0] as ReviewResult;
      expect(savedResult.reviewSequence).toBe(1);
      expect(savedResult.isReReview).toBeUndefined();
      expect(savedResult.previousReviewId).toBeUndefined();
    });

    it('should emit error event when PR is not found', async () => {
      mockGithubService.getPullRequest.mockResolvedValue(null);

      service.queueReview(42, '/repo');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        InternalReviewEvents.ERROR,
        expect.objectContaining({
          prNumber: 42,
          error: expect.stringContaining('not found'),
        })
      );
    });

    it('should emit error event when diff cannot be fetched', async () => {
      mockGithubService.getPrDiff.mockResolvedValue(null);

      service.queueReview(42, '/repo');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        InternalReviewEvents.ERROR,
        expect.objectContaining({
          prNumber: 42,
          error: expect.stringContaining('diff'),
        })
      );
    });

    it('should emit error event when provider is not available', async () => {
      mockProviderRegistry.getClaude.mockReturnValueOnce(undefined);

      service.queueReview(42, '/repo');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        InternalReviewEvents.ERROR,
        expect.objectContaining({
          prNumber: 42,
          error: expect.stringContaining('not available'),
        })
      );
    });

    it('should handle getPrHeadSha failure gracefully', async () => {
      mockGithubService.getPrHeadSha.mockRejectedValue(new Error('sha fetch failed'));

      const result = createMockResult();
      mockProvider.reviewAuto.mockReturnValue(createMockGenerator(result));

      service.queueReview(42, '/repo');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should still complete the review
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        InternalReviewEvents.COMPLETE,
        expect.objectContaining({ prNumber: 42 })
      );

      // headCommitSha should be undefined
      const savedResult = mockHistoryService.save.mock.calls[0][0] as ReviewResult;
      expect(savedResult.headCommitSha).toBeUndefined();
    });

    it('should proceed when getCommitDiff fails for re-review', async () => {
      const previousEntry = createMockHistoryEntry({
        prNumber: 42,
        headCommitSha: 'prev-sha',
      });
      mockHistoryService.getById.mockReturnValue(previousEntry);
      mockGithubService.getCommitDiff.mockRejectedValue(new Error('diff failed'));

      const result = createMockResult();
      mockProvider.reviewAuto.mockReturnValue(createMockGenerator(result));

      service.queueReReview(42, '/repo', 'rh-42-prev');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should still run the review
      const reviewParams = mockProvider.reviewAuto.mock.calls[0][0];
      expect(reviewParams.isReReview).toBe(true);
      expect(reviewParams.incrementalDiff).toBeUndefined();

      // Should still complete
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        InternalReviewEvents.COMPLETE,
        expect.objectContaining({ prNumber: 42 })
      );
    });
  });

  // ========================================================================
  // Provider delegation (review mode selection is in the provider layer)
  // ========================================================================

  describe('provider delegation', () => {
    it('should always delegate to provider.reviewAuto', async () => {
      const result = createMockResult();
      mockProvider.reviewAuto.mockReturnValue(createMockGenerator(result));

      service.queueReview(42, '/repo');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockProvider.reviewAuto).toHaveBeenCalled();
    });

    it('should pass isReReview flag to provider.reviewAuto for re-reviews', async () => {
      const previousEntry = createMockHistoryEntry({
        prNumber: 42,
        qualityScore: 6,
        headCommitSha: 'prev-sha',
        reviewSequence: 1,
      });
      mockHistoryService.getById.mockReturnValue(previousEntry);
      mockGithubService.getCommitDiff.mockResolvedValue('incremental diff');

      const result = createMockResult({ qualityScore: 8 });
      mockProvider.reviewAuto.mockReturnValue(createMockGenerator(result));

      service.queueReReview(42, '/repo', 'rh-42-prev');
      await new Promise(resolve => setTimeout(resolve, 50));

      const reviewParams = mockProvider.reviewAuto.mock.calls[0][0];
      expect(reviewParams.isReReview).toBe(true);
    });
  });

  // ========================================================================
  // getQueue
  // ========================================================================

  describe('getQueue', () => {
    it('should return empty array initially', () => {
      expect(service.getQueue()).toEqual([]);
    });
  });
});
