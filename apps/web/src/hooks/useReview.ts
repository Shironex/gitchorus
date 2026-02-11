import { useCallback, useEffect } from 'react';
import { socket } from '@/lib/socket';
import { emitAsync } from '@/lib/socketHelpers';
import { useRepositoryStore } from '@/stores/useRepositoryStore';
import { useReviewStore } from '@/stores/useReviewStore';
import {
  ReviewEvents,
  GithubEvents,
  createLogger,
  type ReviewStartPayload,
  type ReviewCancelPayload,
  type ReviewProgressResponse,
  type ReviewCompleteResponse,
  type ReviewErrorResponse,
  type ReviewFinding,
  type GithubCreatePrReviewPayload,
  type GithubCreatePrReviewResponse,
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

  const pushReview = useCallback(
    async (
      prNumber: number,
      selectedFindings: ReviewFinding[],
      verdict: string,
      qualityScore: number,
      reviewAction: 'REQUEST_CHANGES' | 'COMMENT',
    ): Promise<{ url?: string; postedComments: number; skippedComments: number }> => {
      if (!repositoryPath) {
        throw new Error('No repository connected');
      }

      const GITCHORUS_MARKER = '<!-- gitchorus-review -->';

      // Build finding summary for the review body
      const findingSummaryParts = selectedFindings.map(
        (f, i) => `${i + 1}. **[${f.severity.toUpperCase()} - ${f.category}]** ${f.title} (\`${f.file}:${f.line}\`)`,
      );

      // Build review body
      const bodyLines = [
        GITCHORUS_MARKER,
        '## GitChorus AI Review',
        '',
        verdict,
        '',
        `**Quality Score:** ${qualityScore}/10`,
        '',
        '### Findings Summary',
        '',
        ...findingSummaryParts,
        '',
        '---',
        '*via [GitChorus](https://github.com/Shironex/gitchorus)*',
      ];

      // Build inline comments
      const comments = selectedFindings.map((f) => ({
        path: f.file,
        line: f.line,
        body: [
          `**[${f.severity.charAt(0).toUpperCase() + f.severity.slice(1)} - ${f.category.charAt(0).toUpperCase() + f.category.slice(1)}]** ${f.title}`,
          '',
          f.explanation,
          '',
          f.codeSnippet ? `**Problematic code:**\n\`\`\`\n${f.codeSnippet}\n\`\`\`` : '',
          '',
          f.suggestedFix ? `**Suggested fix:**\n\`\`\`\n${f.suggestedFix}\n\`\`\`` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      }));

      const payload: GithubCreatePrReviewPayload = {
        projectPath: repositoryPath,
        prNumber,
        body: bodyLines.join('\n'),
        event: reviewAction,
        comments,
      };

      try {
        const response = await emitAsync<
          GithubCreatePrReviewPayload,
          GithubCreatePrReviewResponse
        >(GithubEvents.CREATE_PR_REVIEW, payload, { timeout: 30000 });

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
    [repositoryPath],
  );

  return {
    startReview,
    cancelReview,
    pushReview,
  };
}
