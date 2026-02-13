import { useCallback, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { emitAsync } from '@/lib/socketHelpers';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useRepositoryStore } from '@/stores/useRepositoryStore';
import { useValidationStore } from '@/stores/useValidationStore';
import { useIssueStore } from '@/stores/useIssueStore';
import {
  ValidationEvents,
  GithubEvents,
  createLogger,
  type ValidationStartPayload,
  type ValidationCancelPayload,
  type ValidationProgressResponse,
  type ValidationCompleteResponse,
  type ValidationErrorResponse,
  type ValidationQueueUpdateResponse,
  type GithubCreateCommentPayload,
  type GithubCreateCommentResponse,
  type GithubListCommentsPayload,
  type GithubListCommentsResponse,
  type GithubUpdateCommentPayload,
  type GithubUpdateCommentResponse,
  type IssueComment,
  type ValidationHistoryListPayload,
  type ValidationHistoryListResponse,
  type ValidationHistoryDeletePayload,
  type ValidationLogEntriesPayload,
  type ValidationLogEntriesResponse,
  type LogEntry,
} from '@gitchorus/shared';

const logger = createLogger('useValidation');

/**
 * Hook that sets up Socket.io listeners for validation events.
 *
 * MUST be called exactly once at the app level (e.g., in App.tsx).
 * Multiple calls will result in duplicate event handling.
 */
export function useValidationSocket() {
  const socketInitialized = useConnectionStore(state => state.socketInitialized);
  const updateQueue = useValidationStore(state => state.updateQueue);
  const addStep = useValidationStore(state => state.addStep);
  const setResult = useValidationStore(state => state.setResult);
  const setError = useValidationStore(state => state.setError);
  const setHistory = useValidationStore(state => state.setHistory);
  const setHistoryLoading = useValidationStore(state => state.setHistoryLoading);
  const setValidationStatus = useIssueStore(state => state.setValidationStatus);

  const repositoryFullName = useRepositoryStore(state => state.githubInfo)?.fullName || null;
  const prevRepoRef = useRef<string | null>(null);

  const fetchHistoryInternal = useCallback(
    async (repoFullName: string) => {
      setHistoryLoading(true);
      try {
        const response = await emitAsync<
          ValidationHistoryListPayload,
          ValidationHistoryListResponse
        >(ValidationEvents.HISTORY_LIST, {
          repositoryFullName: repoFullName,
        });

        if (response.error) {
          logger.warn('Error fetching history:', response.error);
          setHistory([]);
        } else {
          setHistory(response.entries);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch history';
        logger.error('Failed to fetch history:', message);
        setHistory([]);
      }
    },
    [setHistory, setHistoryLoading]
  );

  // Set up Socket.io listeners — deferred until socket is initialized
  useEffect(() => {
    if (!socketInitialized) return;

    const socket = getSocket();

    const onProgress = (data: ValidationProgressResponse) => {
      logger.debug(`Progress #${data.issueNumber}: ${data.step.message}`);
      addStep(data.issueNumber, data.step);
    };

    const onComplete = (data: ValidationCompleteResponse) => {
      logger.info(`Complete #${data.issueNumber}: ${data.result.verdict}`);
      setResult(data.issueNumber, data.result);
      setValidationStatus(data.issueNumber, 'completed');
      // Refresh history after a validation completes
      const repoName = useRepositoryStore.getState().githubInfo?.fullName;
      if (repoName) {
        fetchHistoryInternal(repoName);
      }
    };

    const onError = (data: ValidationErrorResponse) => {
      logger.warn(`Error #${data.issueNumber}: ${data.error}`);
      setError(data.issueNumber, data.error);
      const isCancelled = data.error.includes('cancelled') || data.error.includes('aborted');
      setValidationStatus(data.issueNumber, isCancelled ? 'cancelled' : 'failed');
    };

    const onQueueUpdate = (data: ValidationQueueUpdateResponse) => {
      logger.debug('Queue update:', data.queue.length, 'items');
      updateQueue(data.queue);
      // Sync validation statuses to issue store
      for (const item of data.queue) {
        setValidationStatus(item.issueNumber, item.status);
      }
    };

    socket.on(ValidationEvents.PROGRESS, onProgress);
    socket.on(ValidationEvents.COMPLETE, onComplete);
    socket.on(ValidationEvents.ERROR, onError);
    socket.on(ValidationEvents.QUEUE_UPDATE, onQueueUpdate);

    return () => {
      socket.off(ValidationEvents.PROGRESS, onProgress);
      socket.off(ValidationEvents.COMPLETE, onComplete);
      socket.off(ValidationEvents.ERROR, onError);
      socket.off(ValidationEvents.QUEUE_UPDATE, onQueueUpdate);
    };
  }, [
    socketInitialized,
    addStep,
    setResult,
    setError,
    updateQueue,
    setValidationStatus,
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
 * Hook that provides validation action functions.
 *
 * Can be called from any component that needs to trigger validation actions.
 * Does NOT set up socket listeners — use useValidationSocket() for that.
 */
export function useValidation() {
  const repositoryPath = useRepositoryStore(state => state.repositoryPath);

  const clearSteps = useValidationStore(state => state.clearSteps);
  const setError = useValidationStore(state => state.setError);
  const setPushStatus = useValidationStore(state => state.setPushStatus);
  const setPostedCommentUrl = useValidationStore(state => state.setPostedCommentUrl);
  const setPostedCommentId = useValidationStore(state => state.setPostedCommentId);
  const setHistory = useValidationStore(state => state.setHistory);
  const setHistoryLoading = useValidationStore(state => state.setHistoryLoading);
  const removeHistoryEntry = useValidationStore(state => state.removeHistoryEntry);
  const setValidationStatus = useIssueStore(state => state.setValidationStatus);

  const startValidation = useCallback(
    async (issueNumber: number) => {
      if (!repositoryPath) return;

      // Clear previous state for this issue
      clearSteps(issueNumber);
      setValidationStatus(issueNumber, 'queued');

      try {
        await emitAsync<ValidationStartPayload, { success: boolean; error?: string }>(
          ValidationEvents.START,
          {
            projectPath: repositoryPath,
            issueNumber,
          }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start validation';
        logger.error('Failed to start validation:', message);
        setError(issueNumber, message);
        setValidationStatus(issueNumber, 'failed');
      }
    },
    [repositoryPath, clearSteps, setError, setValidationStatus]
  );

  const cancelValidation = useCallback(async (issueNumber: number) => {
    try {
      await emitAsync<ValidationCancelPayload, { success: boolean; error?: string }>(
        ValidationEvents.CANCEL,
        { issueNumber }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel validation';
      logger.error('Failed to cancel validation:', message);
    }
  }, []);

  const pushToGithub = useCallback(
    async (issueNumber: number, body: string): Promise<string | null> => {
      if (!repositoryPath) return null;

      setPushStatus(issueNumber, 'pushing');

      try {
        const response = await emitAsync<GithubCreateCommentPayload, GithubCreateCommentResponse>(
          GithubEvents.CREATE_COMMENT,
          {
            projectPath: repositoryPath,
            issueNumber,
            body,
          }
        );

        if (!response.success || !response.commentUrl) {
          throw new Error(response.error || 'Failed to create comment');
        }

        setPushStatus(issueNumber, 'posted');
        setPostedCommentUrl(issueNumber, response.commentUrl);
        logger.info(`Comment posted for #${issueNumber}: ${response.commentUrl}`);
        return response.commentUrl;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to push to GitHub';
        logger.error('Failed to push to GitHub:', message);
        setPushStatus(issueNumber, 'idle');
        return null;
      }
    },
    [repositoryPath, setPushStatus, setPostedCommentUrl]
  );

  const updateGithubComment = useCallback(
    async (issueNumber: number, commentId: string, body: string): Promise<string | null> => {
      if (!repositoryPath) return null;

      setPushStatus(issueNumber, 'pushing');

      try {
        const response = await emitAsync<GithubUpdateCommentPayload, GithubUpdateCommentResponse>(
          GithubEvents.UPDATE_COMMENT,
          {
            projectPath: repositoryPath,
            commentId,
            body,
          }
        );

        if (!response.success || !response.commentUrl) {
          throw new Error(response.error || 'Failed to update comment');
        }

        setPushStatus(issueNumber, 'posted');
        setPostedCommentUrl(issueNumber, response.commentUrl);
        setPostedCommentId(issueNumber, commentId);
        logger.info(`Comment updated for #${issueNumber}: ${response.commentUrl}`);
        return response.commentUrl;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update comment';
        logger.error('Failed to update GitHub comment:', message);
        setPushStatus(issueNumber, 'idle');
        return null;
      }
    },
    [repositoryPath, setPushStatus, setPostedCommentUrl, setPostedCommentId]
  );

  const listComments = useCallback(
    async (issueNumber: number): Promise<IssueComment[]> => {
      if (!repositoryPath) return [];

      try {
        const response = await emitAsync<GithubListCommentsPayload, GithubListCommentsResponse>(
          GithubEvents.LIST_COMMENTS,
          {
            projectPath: repositoryPath,
            issueNumber,
          }
        );

        if (response.error) {
          logger.warn('Error listing comments:', response.error);
          return [];
        }

        return response.comments;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to list comments';
        logger.error('Failed to list comments:', message);
        return [];
      }
    },
    [repositoryPath]
  );

  /**
   * Fetch history for a given repository.
   * Can be called externally to refresh history.
   */
  const fetchHistory = useCallback(
    async (repoFullName: string) => {
      setHistoryLoading(true);
      try {
        const response = await emitAsync<
          ValidationHistoryListPayload,
          ValidationHistoryListResponse
        >(ValidationEvents.HISTORY_LIST, {
          repositoryFullName: repoFullName,
        });

        if (response.error) {
          logger.warn('Error fetching history:', response.error);
          setHistory([]);
        } else {
          setHistory(response.entries);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch history';
        logger.error('Failed to fetch history:', message);
        setHistory([]);
      }
    },
    [setHistory, setHistoryLoading]
  );

  /**
   * Delete a history entry by ID.
   */
  const deleteHistoryEntry = useCallback(
    async (id: string) => {
      try {
        const response = await emitAsync<
          ValidationHistoryDeletePayload,
          { success: boolean; error?: string }
        >(ValidationEvents.HISTORY_DELETE, { id });

        if (response.success) {
          removeHistoryEntry(id);
        } else {
          logger.warn('Failed to delete history entry:', response.error);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete history entry';
        logger.error('Failed to delete history entry:', message);
      }
    },
    [removeHistoryEntry]
  );

  /**
   * Fetch recent backend log entries for the validation log panel.
   * Returns an array of LogEntry objects (future use — plumbing ready).
   */
  const fetchLogEntries = useCallback(async (limit: number = 100): Promise<LogEntry[]> => {
    try {
      const response = await emitAsync<ValidationLogEntriesPayload, ValidationLogEntriesResponse>(
        ValidationEvents.LOG_ENTRIES,
        { limit }
      );

      if (response.error) {
        logger.warn('Error fetching log entries:', response.error);
        return [];
      }

      return response.entries;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch log entries';
      logger.error('Failed to fetch log entries:', message);
      return [];
    }
  }, []);

  /**
   * Check if a validation result is stale compared to the issue's updatedAt.
   * Returns true if the issue was updated after the validation completed.
   */
  const isStale = useCallback((validatedAt: string, issueUpdatedAt: string): boolean => {
    const validatedTime = new Date(validatedAt).getTime();
    const updatedTime = new Date(issueUpdatedAt).getTime();
    return updatedTime > validatedTime;
  }, []);

  return {
    startValidation,
    cancelValidation,
    pushToGithub,
    updateGithubComment,
    listComments,
    fetchHistory,
    deleteHistoryEntry,
    fetchLogEntries,
    isStale,
  };
}
