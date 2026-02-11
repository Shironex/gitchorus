/**
 * WebSocket Payloads and Responses
 *
 * These types define the contract between the frontend and backend
 * for socket.io event communication.
 */

import type { BranchInfo, CommitInfo } from './git';
import type {
  GhCliStatus,
  RepoInfo,
  PullRequest,
  Issue,
} from './github';

// ============================================
// Generic Response Types
// ============================================

/**
 * Generic success/error response for mutations
 */
export interface SuccessResponse {
  success: boolean;
  error?: string;
}

/**
 * Generic data response for queries (check error field for failure)
 */
export interface DataResponse<T> {
  data: T;
  error?: string;
}

/**
 * Payload with project path
 */
export interface ProjectPathPayload {
  projectPath: string;
}

// ============================================
// Git Payloads
// ============================================

/**
 * Payload for getting branches
 */
export interface GitBranchesPayload {
  projectPath: string;
}

/**
 * Payload for getting commits
 */
export interface GitCommitsPayload {
  projectPath: string;
  limit?: number;
  allBranches?: boolean;
}

/**
 * Payload for checkout
 */
export interface GitCheckoutPayload {
  projectPath: string;
  branch: string;
}

/**
 * Payload for creating a branch
 */
export interface GitCreateBranchPayload {
  projectPath: string;
  name: string;
  startPoint?: string;
}

/**
 * Payload for getting current branch
 */
export interface GitCurrentBranchPayload {
  projectPath: string;
}

// ============================================
// Git Responses
// ============================================

/**
 * Response for branches query.
 * currentBranch may be a string (name only) or a full BranchInfo object.
 */
export interface GitBranchesResponse {
  branches: BranchInfo[];
  currentBranch: string | BranchInfo;
  error?: string;
}

/**
 * Response for commits query
 */
export interface GitCommitsResponse {
  commits: CommitInfo[];
  error?: string;
}

/**
 * Response for checkout mutation
 */
export interface GitCheckoutResponse extends SuccessResponse {
  currentBranch?: string;
}

/**
 * Response for create branch mutation
 */
export interface GitCreateBranchResponse extends SuccessResponse {
  branch?: BranchInfo;
}

/**
 * Response for current branch query
 */
export interface GitCurrentBranchResponse {
  currentBranch: string;
  error?: string;
}

// ============================================
// GitHub Payloads
// ============================================

/**
 * Payload for getting GitHub CLI status
 */
export interface GithubStatusPayload {
  /** Force refresh (bypass cache) */
  refresh?: boolean;
}

/**
 * Payload for GitHub operations that require a project path
 */
export interface GithubProjectPayload {
  projectPath: string;
}

/**
 * Payload for listing pull requests
 */
export interface GithubListPRsPayload extends GithubProjectPayload {
  /** Filter by state */
  state?: 'open' | 'closed' | 'all';
  /** Maximum number to return */
  limit?: number;
}

/**
 * Payload for creating a pull request
 */
export interface GithubCreatePRPayload extends GithubProjectPayload {
  /** PR title */
  title: string;
  /** PR body/description */
  body?: string;
  /** Base branch */
  base?: string;
  /** Head branch */
  head?: string;
  /** Create as draft */
  draft?: boolean;
}

/**
 * Payload for getting a specific PR
 */
export interface GithubGetPRPayload extends GithubProjectPayload {
  /** PR number */
  prNumber: number;
}

/**
 * Payload for listing issues
 */
export interface GithubListIssuesPayload extends GithubProjectPayload {
  /** Filter by state */
  state?: 'open' | 'closed' | 'all';
  /** Maximum number to return */
  limit?: number;
  /** Filter by labels */
  labels?: string[];
}

/**
 * Payload for getting a specific issue
 */
export interface GithubGetIssuePayload extends GithubProjectPayload {
  /** Issue number */
  issueNumber: number;
}

// ============================================
// GitHub Responses
// ============================================

/**
 * Response for GitHub CLI status
 */
export interface GithubStatusResponse {
  status: GhCliStatus;
  error?: string;
}

/**
 * Response for repository info
 */
export interface GithubRepoInfoResponse {
  repo: RepoInfo | null;
  error?: string;
}

/**
 * Response for pull requests list
 */
export interface GithubPRsResponse {
  pullRequests: PullRequest[];
  error?: string;
}

/**
 * Response for a single pull request
 */
export interface GithubPRResponse {
  pullRequest: PullRequest | null;
  error?: string;
}

/**
 * Response for creating a pull request
 */
export interface GithubCreatePRResponse extends SuccessResponse {
  pullRequest?: PullRequest;
}

/**
 * Response for issues list
 */
export interface GithubIssuesResponse {
  issues: Issue[];
  error?: string;
}

/**
 * Response for a single issue
 */
export interface GithubIssueResponse {
  issue: Issue | null;
  error?: string;
}
