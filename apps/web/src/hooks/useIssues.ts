import { useCallback, useEffect, useRef } from 'react';
import { emitAsync } from '@/lib/socketHelpers';
import { useRepositoryStore } from '@/stores/useRepositoryStore';
import { useIssueStore } from '@/stores/useIssueStore';
import {
  GithubEvents,
  createLogger,
  type GithubListIssuesPayload,
  type GithubIssuesResponse,
} from '@gitchorus/shared';

const logger = createLogger('useIssues');

/**
 * Hook that fetches issues from the connected GitHub repository.
 *
 * Automatically fetches on mount when a repository with GitHub info is connected.
 * Provides a refetch function for manual refresh.
 */
export function useIssues() {
  const repositoryPath = useRepositoryStore((state) => state.repositoryPath);
  const githubInfo = useRepositoryStore((state) => state.githubInfo);
  const { setIssues, setLoading, setError, clearIssues } = useIssueStore();
  const issues = useIssueStore((state) => state.issues);
  const isLoading = useIssueStore((state) => state.isLoading);
  const error = useIssueStore((state) => state.error);

  // Track whether we've already fetched for this repo
  const fetchedForPath = useRef<string | null>(null);

  const fetchIssues = useCallback(async () => {
    if (!repositoryPath || !githubInfo) {
      clearIssues();
      return;
    }

    try {
      setLoading(true);
      setError(null);

      logger.info('Fetching issues for', githubInfo.fullName);

      const response = await emitAsync<GithubListIssuesPayload, GithubIssuesResponse>(
        GithubEvents.ISSUES,
        {
          projectPath: repositoryPath,
          state: 'open',
          limit: 100,
        }
      );

      if (response.error) {
        setError(response.error);
        return;
      }

      setIssues(response.issues);
      logger.info(`Loaded ${response.issues.length} issues`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch issues';
      logger.error('Failed to fetch issues:', message);
      setError(message);
    }
  }, [repositoryPath, githubInfo, setIssues, setLoading, setError, clearIssues]);

  // Auto-fetch on mount when GitHub info is available
  useEffect(() => {
    if (repositoryPath && githubInfo && fetchedForPath.current !== repositoryPath) {
      fetchedForPath.current = repositoryPath;
      fetchIssues();
    }

    // Clear if no repo connected
    if (!repositoryPath) {
      fetchedForPath.current = null;
    }
  }, [repositoryPath, githubInfo, fetchIssues]);

  const refetch = useCallback(() => {
    fetchedForPath.current = null;
    if (repositoryPath) {
      fetchedForPath.current = repositoryPath;
    }
    return fetchIssues();
  }, [fetchIssues, repositoryPath]);

  return { issues, isLoading, error, refetch };
}
