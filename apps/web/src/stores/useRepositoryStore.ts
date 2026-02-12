import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createLogger } from '@gitchorus/shared';
import type { RepoInfo } from '@gitchorus/shared';

const logger = createLogger('RepositoryStore');

/**
 * Repository state
 */
interface RepositoryState {
  /** Absolute local path of connected repository */
  repositoryPath: string | null;
  /** Repository display name (folder name) */
  repositoryName: string | null;
  /** Current git branch */
  currentBranch: string | null;
  /** GitHub remote info (null if no remote or not detected) */
  githubInfo: RepoInfo | null;
  /** Whether a connection attempt is in progress */
  isConnecting: boolean;
  /** Error message from last connection attempt */
  error: string | null;
}

/**
 * Repository actions
 */
interface RepositoryActions {
  /** Set repository connection info after successful validation */
  setRepository: (path: string, name: string, branch: string, github: RepoInfo | null) => void;
  /** Clear repository connection (back to welcome screen) */
  clearRepository: () => void;
  /** Set connecting state */
  setConnecting: (connecting: boolean) => void;
  /** Set error message */
  setError: (error: string | null) => void;
}

/**
 * Combined store type
 */
type RepositoryStore = RepositoryState & RepositoryActions;

/**
 * Repository store using Zustand
 *
 * Manages the state of the currently connected git repository.
 * When repositoryPath is null, the app shows the welcome screen.
 * When set, the app shows the repo info view.
 */
export const useRepositoryStore = create<RepositoryStore>()(
  devtools(
    set => ({
      // Initial state
      repositoryPath: null,
      repositoryName: null,
      currentBranch: null,
      githubInfo: null,
      isConnecting: false,
      error: null,

      // Actions
      setRepository: (path: string, name: string, branch: string, github: RepoInfo | null) => {
        logger.info('Repository connected:', name, `(${path})`);
        set(
          {
            repositoryPath: path,
            repositoryName: name,
            currentBranch: branch,
            githubInfo: github,
            isConnecting: false,
            error: null,
          },
          undefined,
          'repository/setRepository'
        );
      },

      clearRepository: () => {
        logger.info('Repository disconnected');
        set(
          {
            repositoryPath: null,
            repositoryName: null,
            currentBranch: null,
            githubInfo: null,
            isConnecting: false,
            error: null,
          },
          undefined,
          'repository/clearRepository'
        );
      },

      setConnecting: (connecting: boolean) => {
        set({ isConnecting: connecting }, undefined, 'repository/setConnecting');
      },

      setError: (error: string | null) => {
        if (error) {
          logger.warn('Repository connection error:', error);
        }
        set({ error, isConnecting: false }, undefined, 'repository/setError');
      },
    }),
    { name: 'repository' }
  )
);

// Selectors

/** Select whether a repository is connected */
export const selectIsConnected = (state: RepositoryStore) => state.repositoryPath !== null;

/** Select the repository path */
export const selectRepositoryPath = (state: RepositoryStore) => state.repositoryPath;

/** Select the repository display name */
export const selectRepositoryName = (state: RepositoryStore) => state.repositoryName;

/** Select the current branch */
export const selectCurrentBranch = (state: RepositoryStore) => state.currentBranch;

/** Select GitHub info */
export const selectGithubInfo = (state: RepositoryStore) => state.githubInfo;

/** Select whether connection is in progress */
export const selectIsConnecting = (state: RepositoryStore) => state.isConnecting;

/** Select error message */
export const selectError = (state: RepositoryStore) => state.error;
