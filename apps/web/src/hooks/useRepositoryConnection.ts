import { useCallback } from 'react';
import { emitAsync } from '@/lib/socketHelpers';
import { useRepositoryStore } from '@/stores/useRepositoryStore';
import {
  RepositoryEvents,
  createLogger,
  type ValidateRepositoryPayload,
  type ValidateRepositoryResponse,
  type GithubRemoteResponse,
} from '@gitchorus/shared';

const logger = createLogger('useRepositoryConnection');

/**
 * Hook that orchestrates the full repository connection flow:
 * 1. Opens a native folder picker dialog
 * 2. Validates the selected folder is a git repository
 * 3. Detects GitHub remote info
 * 4. Updates the repository store
 *
 * @returns openRepository and changeRepository callbacks
 */
export function useRepositoryConnection() {
  const setRepository = useRepositoryStore(state => state.setRepository);
  const clearRepository = useRepositoryStore(state => state.clearRepository);
  const setConnecting = useRepositoryStore(state => state.setConnecting);
  const setError = useRepositoryStore(state => state.setError);

  const openRepository = useCallback(async () => {
    try {
      // Reset error state
      setError(null);

      // Step 1: Open native folder picker
      if (!window.electronAPI?.dialog?.openDirectory) {
        setError('Folder picker is not available');
        return;
      }

      const selectedPath = await window.electronAPI.dialog.openDirectory({
        title: 'Select a Git Repository',
      });

      if (!selectedPath) {
        // User cancelled the dialog
        return;
      }

      logger.info('Selected path:', selectedPath);
      setConnecting(true);

      // Step 2: Validate the selected folder is a git repository
      const validation = await emitAsync<ValidateRepositoryPayload, ValidateRepositoryResponse>(
        RepositoryEvents.VALIDATE_REPO,
        { projectPath: selectedPath }
      );

      if (!validation.valid) {
        setError(validation.reason || 'The selected folder is not a valid git repository');
        return;
      }

      // Step 3: Detect GitHub remote info (best effort - not required)
      let githubInfo = null;
      try {
        const remoteResponse = await emitAsync<ValidateRepositoryPayload, GithubRemoteResponse>(
          RepositoryEvents.GET_GITHUB_REMOTE,
          { projectPath: selectedPath }
        );
        if (remoteResponse.repo && !remoteResponse.error) {
          githubInfo = remoteResponse.repo;
        }
      } catch (err) {
        logger.warn('Failed to detect GitHub remote (non-blocking):', err);
      }

      // Step 4: Update the repository store
      setRepository(
        selectedPath,
        validation.repoName || selectedPath.split('/').pop() || 'Unknown',
        validation.currentBranch || 'main',
        githubInfo
      );

      logger.info('Repository connected successfully:', validation.repoName);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect repository';
      logger.error('Repository connection failed:', message);
      setError(message);
    }
  }, [setRepository, setConnecting, setError]);

  const changeRepository = useCallback(async () => {
    clearRepository();
    // Allow a brief tick for state to clear, then open picker
    setTimeout(() => {
      openRepository();
    }, 50);
  }, [clearRepository, openRepository]);

  return { openRepository, changeRepository };
}
