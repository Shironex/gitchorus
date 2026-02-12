import { useCallback, useEffect, useRef } from 'react';
import { emitAsync } from '@/lib/socketHelpers';
import { useRepositoryStore } from '@/stores/useRepositoryStore';
import { useReviewStore } from '@/stores/useReviewStore';
import {
  GithubEvents,
  createLogger,
  type GithubListPRsPayload,
  type GithubPRsResponse,
} from '@gitchorus/shared';

const logger = createLogger('usePullRequests');

/**
 * Hook that fetches pull requests from the connected GitHub repository.
 *
 * Automatically fetches on mount when a repository with GitHub info is connected.
 * Passes the store's filterState to the backend so the API returns the correct set.
 * Provides a refetch function for manual refresh.
 */
export function usePullRequests() {
  const repositoryPath = useRepositoryStore(state => state.repositoryPath);
  const githubInfo = useRepositoryStore(state => state.githubInfo);
  const setPullRequests = useReviewStore(state => state.setPullRequests);
  const setLoading = useReviewStore(state => state.setLoading);
  const setError = useReviewStore(state => state.setError);
  const clearPullRequests = useReviewStore(state => state.clearPullRequests);
  const pullRequests = useReviewStore(state => state.pullRequests);
  const loading = useReviewStore(state => state.loading);
  const error = useReviewStore(state => state.error);
  const filterState = useReviewStore(state => state.filterState);

  // Track whether we've already fetched for this repo + filter combination
  const fetchedForKey = useRef<string | null>(null);

  const fetchPullRequests = useCallback(async () => {
    if (!repositoryPath || !githubInfo) {
      clearPullRequests();
      return;
    }

    try {
      setLoading(true);
      setError(null);

      logger.info('Fetching PRs for', githubInfo.fullName, 'state:', filterState);

      const response = await emitAsync<GithubListPRsPayload, GithubPRsResponse>(GithubEvents.PRS, {
        projectPath: repositoryPath,
        state: filterState,
        limit: 100,
      });

      if (response.error) {
        setError(response.error);
        return;
      }

      setPullRequests(response.pullRequests);
      logger.info(`Loaded ${response.pullRequests.length} PRs`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch pull requests';
      logger.error('Failed to fetch PRs:', message);
      setError(message);
    }
  }, [
    repositoryPath,
    githubInfo,
    filterState,
    setPullRequests,
    setLoading,
    setError,
    clearPullRequests,
  ]);

  // Auto-fetch on mount when GitHub info is available, or when filterState changes
  useEffect(() => {
    const key = repositoryPath ? `${repositoryPath}:${filterState}` : null;
    if (repositoryPath && githubInfo && fetchedForKey.current !== key) {
      fetchedForKey.current = key;
      fetchPullRequests();
    }

    // Clear if no repo connected
    if (!repositoryPath) {
      fetchedForKey.current = null;
    }
  }, [repositoryPath, githubInfo, filterState, fetchPullRequests]);

  const refresh = useCallback(() => {
    fetchedForKey.current = null;
    if (repositoryPath) {
      fetchedForKey.current = `${repositoryPath}:${filterState}`;
    }
    return fetchPullRequests();
  }, [fetchPullRequests, repositoryPath, filterState]);

  return { pullRequests, loading, error, refresh };
}
