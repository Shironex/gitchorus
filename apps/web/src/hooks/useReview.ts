import { useCallback, useEffect } from 'react';
import { socket } from '@/lib/socket';
import { emitAsync } from '@/lib/socketHelpers';
import { useRepositoryStore } from '@/stores/useRepositoryStore';
import { useReviewStore } from '@/stores/useReviewStore';
import {
  ReviewEvents,
  createLogger,
  type ReviewStartPayload,
  type ReviewCancelPayload,
  type ReviewProgressResponse,
  type ReviewCompleteResponse,
  type ReviewErrorResponse,
} from '@gitchorus/shared';

const logger = createLogger('useReview');

/**
 * Hook that sets up Socket.io listeners for review events.
 *
 * MUST be called exactly once at the app level (e.g., in App.tsx).
 * Multiple calls will result in duplicate event handling.
 */
export function useReviewSocket() {
  const addReviewStep = useReviewStore((state) => state.addReviewStep);
  const setReviewResult = useReviewStore((state) => state.setReviewResult);
  const setReviewError = useReviewStore((state) => state.setReviewError);
  const setReviewStatus = useReviewStore((state) => state.setReviewStatus);

  useEffect(() => {
    const onProgress = (data: ReviewProgressResponse) => {
      logger.debug(`Progress PR #${data.prNumber}: ${data.step.message}`);
      addReviewStep(data.prNumber, data.step);
    };

    const onComplete = (data: ReviewCompleteResponse) => {
      logger.info(`Complete PR #${data.prNumber}: ${data.result.verdict}`);
      setReviewResult(data.prNumber, data.result);
      setReviewStatus(data.prNumber, 'completed');
    };

    const onError = (data: ReviewErrorResponse) => {
      logger.warn(`Error PR #${data.prNumber}: ${data.error}`);
      setReviewError(data.prNumber, data.error);
      const isCancelled =
        data.error.includes('cancelled') || data.error.includes('aborted');
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
  }, [addReviewStep, setReviewResult, setReviewError, setReviewStatus]);
}

/**
 * Hook that provides review action functions.
 *
 * Can be called from any component that needs to trigger review actions.
 * Does NOT set up socket listeners -- use useReviewSocket() for that.
 */
export function useReview() {
  const repositoryPath = useRepositoryStore((state) => state.repositoryPath);
  const clearReview = useReviewStore((state) => state.clearReview);
  const setReviewStatus = useReviewStore((state) => state.setReviewStatus);
  const setReviewError = useReviewStore((state) => state.setReviewError);

  const startReview = useCallback(
    async (prNumber: number) => {
      if (!repositoryPath) return;

      // Clear previous state for this PR
      clearReview(prNumber);
      setReviewStatus(prNumber, 'queued');

      try {
        await emitAsync<
          ReviewStartPayload,
          { success: boolean; error?: string }
        >(ReviewEvents.START, {
          projectPath: repositoryPath,
          prNumber,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to start review';
        logger.error('Failed to start review:', message);
        setReviewError(prNumber, message);
        setReviewStatus(prNumber, 'failed');
      }
    },
    [repositoryPath, clearReview, setReviewStatus, setReviewError]
  );

  const cancelReview = useCallback(
    async (prNumber: number) => {
      try {
        await emitAsync<
          ReviewCancelPayload,
          { success: boolean; error?: string }
        >(ReviewEvents.CANCEL, { prNumber });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to cancel review';
        logger.error('Failed to cancel review:', message);
      }
    },
    []
  );

  return {
    startReview,
    cancelReview,
  };
}
