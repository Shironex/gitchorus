/**
 * Repository Connection Types
 *
 * Types for the repository connection flow: folder picker,
 * git validation, and GitHub remote detection.
 */

import type { RepoInfo } from './github';

// ============================================
// Repository Connection
// ============================================

/** State of a connected repository */
export interface RepositoryConnection {
  /** Absolute local path */
  localPath: string;
  /** Repository name (folder name) */
  name: string;
  /** Current git branch */
  currentBranch: string;
  /** GitHub remote info (null if no GitHub remote) */
  github: RepoInfo | null;
}

// ============================================
// Validation Payloads & Responses
// ============================================

/** Payload for repository validation request */
export interface ValidateRepositoryPayload {
  projectPath: string;
}

/** Response from repository validation */
export interface ValidateRepositoryResponse {
  valid: boolean;
  reason?: string;
  repoName?: string;
  currentBranch?: string;
}

/** Response from GitHub remote detection */
export interface GithubRemoteResponse {
  repo: RepoInfo | null;
  error?: string;
}
