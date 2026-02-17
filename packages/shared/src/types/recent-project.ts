/**
 * Recent Project Persistence Types
 *
 * Used by electron-store under the 'recentProjects' key
 * to persist recently opened projects across app restarts.
 */

import type { RepoInfo } from './github';

/** A recently opened project saved for quick reconnection */
export interface RecentProject {
  /** Absolute local filesystem path */
  localPath: string;
  /** Repository display name (folder name) */
  name: string;
  /** Last known git branch */
  currentBranch: string;
  /** GitHub remote info (null if no GitHub remote) */
  github: RepoInfo | null;
  /** ISO timestamp of when the project was last opened */
  lastOpened: string;
}
