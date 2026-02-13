import { useCallback, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { emitAsync } from '@/lib/socketHelpers';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useRepositoryStore } from '@/stores/useRepositoryStore';
import { useReviewStore } from '@/stores/useReviewStore';
import {
  ReviewEvents,
  GithubEvents,
  createLogger,
  type ReviewStartPayload,
  type ReviewReReviewStartPayload,
  type ReviewCancelPayload,
  type ReviewProgressResponse,
  type ReviewCompleteResponse,
  type ReviewErrorResponse,
  type ReviewFinding,
  type GithubCreatePrReviewPayload,
  type GithubCreatePrReviewResponse,
  type ReviewHistoryListPayload,
  type ReviewHistoryListResponse,
  type ReviewHistoryDeletePayload,
  type ReviewChainPayload,
  type ReviewChainResponse,
} from '@gitchorus/shared';
import {
  formatReviewSummaryBody,
  formatInlineCommentBody,
  normalizeFindingPath,
} from '@/lib/reviewFormatter';

const logger = createLogger('useReview');

/**
 * Hook that sets up Socket.io listeners for review events.
 *
 * MUST be called exactly once at the app level (e.g., in App.tsx).
 * Multiple calls will result in duplicate event handling.
 */
export function useReviewSocket() {
  const socketInitialized = useConnectionStore(state => state.socketInitialized);
  const addReviewStep = useReviewStore(state => state.addReviewStep);
  const setReviewResult = useReviewStore(state => state.setReviewResult);
  const setReviewError = useReviewStore(state => state.setReviewError);
  const setReviewStatus = useReviewStore(state => state.setReviewStatus);
  const setReviewHistory = useReviewStore(state => state.setReviewHistory);
  const setHistoryLoading = useReviewStore(state => state.setHistoryLoading);

  const repositoryFullName = useRepositoryStore(state => state.githubInfo)?.fullName || null;
  const prevRepoRef = useRef<string | null>(null);

  const fetchHistoryInternal = useCallback(
    async (repoFullName: string) => {
      setHistoryLoading(true);
      try {
        const response = await emitAsync<ReviewHistoryListPayload, ReviewHistoryListResponse>(
          ReviewEvents.HISTORY_LIST,
          {
            repositoryFullName: repoFullName,
          }
        );

        if (response.error) {
          logger.warn('Error fetching review history:', response.error);
          setReviewHistory([]);
        } else {
          setReviewHistory(response.entries);

          // Hydrate reviewResults map from history so past reviews
          // show immediately when revisiting a PR
          const setResult = useReviewStore.getState().setReviewResult;
          const setStatus = useReviewStore.getState().setReviewStatus;
          const currentResults = useReviewStore.getState().reviewResults;

          for (const entry of response.entries) {
            // Only hydrate if no live result exists for this PR
            if (!currentResults.has(entry.prNumber)) {
              setResult(entry.prNumber, entry);
              setStatus(entry.prNumber, 'completed');
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch review history';
        logger.error('Failed to fetch review history:', message);
        setReviewHistory([]);
      }
    },
    [setReviewHistory, setHistoryLoading]
  );

  useEffect(() => {
    if (!socketInitialized) return;

    const socket = getSocket();

    const onProgress = (data: ReviewProgressResponse) => {
      logger.debug(`Progress PR #${data.prNumber}: ${data.step.message}`);
      addReviewStep(data.prNumber, data.step);
    };

    const onComplete = (data: ReviewCompleteResponse) => {
      logger.info(`Complete PR #${data.prNumber}: ${data.result.verdict}`);
      setReviewResult(data.prNumber, data.result);
      setReviewStatus(data.prNumber, 'completed');
      // Refresh history after a review completes
      const repoName = useRepositoryStore.getState().githubInfo?.fullName;
      if (repoName) {
        fetchHistoryInternal(repoName);
      }
    };

    const onError = (data: ReviewErrorResponse) => {
      logger.warn(`Error PR #${data.prNumber}: ${data.error}`);
      setReviewError(data.prNumber, data.error);
      const isCancelled = data.error.includes('cancelled') || data.error.includes('aborted');
      setReviewStatus(data.prNumber, isCancelled ? 'cancelled' : 'failed');
    };

    socket.on(ReviewEvents.PROGRESS, onProgress);
    socket.on(ReviewEvents.COMPLETE, onComplete);
    socket.on(ReviewEvents.ERROR, onError);

    return () => {
      socket.off(ReviewEvents.PROGRESS, onProgress);
      socket.off(ReviewEvents.COMPLETE, onComplete);
      socket.off(ReviewEvents.ERROR, onError);
    };
  }, [
    socketInitialized,
    addReviewStep,
    setReviewResult,
    setReviewError,
    setReviewStatus,
    fetchHistoryInternal,
  ]);

  // Fetch history when repository changes
  useEffect(() => {
    if (repositoryFullName && repositoryFullName !== prevRepoRef.current) {
      fetchHistoryInternal(repositoryFullName);
    }
    prevRepoRef.current = repositoryFullName;
  }, [repositoryFullName, fetchHistoryInternal]);
}

/**
 * Hook that provides review action functions.
 *
 * Can be called from any component that needs to trigger review actions.
 * Does NOT set up socket listeners -- use useReviewSocket() for that.
 */
export function useReview() {
  const repositoryPath = useRepositoryStore(state => state.repositoryPath);
  const clearReview = useReviewStore(state => state.clearReview);
  const clearReviewForReReview = useReviewStore(state => state.clearReviewForReReview);
  const setReviewStatus = useReviewStore(state => state.setReviewStatus);
  const setReviewError = useReviewStore(state => state.setReviewError);
  const setReviewHistory = useReviewStore(state => state.setReviewHistory);
  const setHistoryLoading = useReviewStore(state => state.setHistoryLoading);
  const removeHistoryEntry = useReviewStore(state => state.removeHistoryEntry);
  const setReviewChain = useReviewStore(state => state.setReviewChain);

  const startReview = useCallback(
    async (prNumber: number) => {
      if (!repositoryPath) return;

      // Clear previous state for this PR
      clearReview(prNumber);
      setReviewStatus(prNumber, 'queued');

      try {
        await emitAsync<ReviewStartPayload, { success: boolean; error?: string }>(
          ReviewEvents.START,
          {
            projectPath: repositoryPath,
            prNumber,
          }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start review';
        logger.error('Failed to start review:', message);
        setReviewError(prNumber, message);
        setReviewStatus(prNumber, 'failed');
      }
    },
    [repositoryPath, clearReview, setReviewStatus, setReviewError]
  );

  const startReReview = useCallback(
    async (prNumber: number, previousReviewId: string) => {
      if (!repositoryPath) return;

      // Only clear steps/errors — preserve the old result until the new one arrives
      clearReviewForReReview(prNumber);
      setReviewStatus(prNumber, 'queued');

      try {
        await emitAsync<ReviewReReviewStartPayload, { success: boolean; error?: string }>(
          ReviewEvents.RE_REVIEW_START,
          {
            projectPath: repositoryPath,
            prNumber,
            previousReviewId,
          }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start re-review';
        logger.error('Failed to start re-review:', message);
        setReviewError(prNumber, message);
        setReviewStatus(prNumber, 'failed');
      }
    },
    [repositoryPath, clearReviewForReReview, setReviewStatus, setReviewError]
  );

  const cancelReview = useCallback(async (prNumber: number) => {
    try {
      await emitAsync<ReviewCancelPayload, { success: boolean; error?: string }>(
        ReviewEvents.CANCEL,
        { prNumber }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel review';
      logger.error('Failed to cancel review:', message);
    }
  }, []);

  const pushReview = useCallback(
    async (
      prNumber: number,
      selectedFindings: ReviewFinding[],
      verdict: string,
      qualityScore: number,
      reviewAction: 'REQUEST_CHANGES' | 'COMMENT'
    ): Promise<{ url?: string; postedComments: number; skippedComments: number }> => {
      if (!repositoryPath) {
        throw new Error('No repository connected');
      }

      // Build review body with rich formatting
      const reviewBody = formatReviewSummaryBody(selectedFindings, verdict, qualityScore);

      // Build inline comments with GitHub alerts and syntax-highlighted code blocks
      const comments = selectedFindings.map(f => ({
        path: normalizeFindingPath(f.file),
        line: f.line,
        body: formatInlineCommentBody(f),
        side: 'RIGHT' as const,
      }));

      const payload: GithubCreatePrReviewPayload = {
        projectPath: repositoryPath,
        prNumber,
        body: reviewBody,
        event: reviewAction,
        comments,
      };

      try {
        const response = await emitAsync<GithubCreatePrReviewPayload, GithubCreatePrReviewResponse>(
          GithubEvents.CREATE_PR_REVIEW,
          payload,
          { timeout: 30000 }
        );

        if (!response.success) {
          throw new Error(response.error || 'Failed to create PR review');
        }

        // If comments were skipped, the backend already handled the fallback
        return {
          url: response.url,
          postedComments: response.postedComments ?? 0,
          skippedComments: response.skippedComments ?? 0,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to push review';
        logger.error('Failed to push review:', message);
        throw new Error(message);
      }
    },
    [repositoryPath]
  );

  /**
   * Fetch review history for a given repository.
   */
  const fetchHistory = useCallback(
    async (repoFullName: string) => {
      setHistoryLoading(true);
      try {
        const response = await emitAsync<ReviewHistoryListPayload, ReviewHistoryListResponse>(
          ReviewEvents.HISTORY_LIST,
          {
            repositoryFullName: repoFullName,
          }
        );

        if (response.error) {
          logger.warn('Error fetching review history:', response.error);
          setReviewHistory([]);
        } else {
          setReviewHistory(response.entries);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch review history';
        logger.error('Failed to fetch review history:', message);
        setReviewHistory([]);
      }
    },
    [setReviewHistory, setHistoryLoading]
  );

  /**
   * Fetch the review chain (all reviews) for a specific PR.
   */
  const fetchReviewChain = useCallback(
    async (prNumber: number, repositoryFullName: string) => {
      try {
        const response = await emitAsync<ReviewChainPayload, ReviewChainResponse>(
          ReviewEvents.CHAIN,
          { prNumber, repositoryFullName }
        );

        if (response.error) {
          logger.warn('Error fetching review chain:', response.error);
        } else {
          setReviewChain(prNumber, response.chain);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch review chain';
        logger.error('Failed to fetch review chain:', message);
      }
    },
    [setReviewChain]
  );

  /**
   * Delete a review history entry by ID.
   */
  const deleteHistoryEntry = useCallback(
    async (id: string) => {
      try {
        const response = await emitAsync<
          ReviewHistoryDeletePayload,
          { success: boolean; error?: string }
        >(ReviewEvents.HISTORY_DELETE, { id });

        if (response.success) {
          removeHistoryEntry(id);
        } else {
          logger.warn('Failed to delete review history entry:', response.error);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete review history entry';
        logger.error('Failed to delete review history entry:', message);
      }
    },
    [removeHistoryEntry]
  );

  return {
    startReview,
    startReReview,
    cancelReview,
    pushReview,
    fetchHistory,
    fetchReviewChain,
    deleteHistoryEntry,
  };
}
