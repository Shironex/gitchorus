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
  IssueComment,
} from './github';
import type { ProviderStatus } from './provider';
import type { LogEntry } from '../logger';
import type { ValidationStep, ValidationResult, ValidationQueueItem, ValidationHistoryEntry } from './validation';
import type { ReviewResult, ReviewQueueItem } from './review';

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

// ============================================
// GitHub PR Diff Payloads
// ============================================

/**
 * Payload for getting a PR diff
 */
export interface GithubPrDiffPayload {
  projectPath: string;
  prNumber: number;
}

/**
 * Response for a PR diff
 */
export interface GithubPrDiffResponse {
  diff: string;
  error?: string;
}

// ============================================
// Review Payloads (for plan 02)
// ============================================

/**
 * Payload to start a PR review
 */
export interface ReviewStartPayload {
  projectPath: string;
  prNumber: number;
}

/**
 * Payload to cancel a running PR review
 */
export interface ReviewCancelPayload {
  prNumber: number;
}

/**
 * Progress update during PR review
 */
export interface ReviewProgressResponse {
  prNumber: number;
  step: ValidationStep;
}

/**
 * PR review completed successfully
 */
export interface ReviewCompleteResponse {
  prNumber: number;
  result: ReviewResult;
}

/**
 * Review queue state update
 */
export interface ReviewQueueUpdateResponse {
  queue: ReviewQueueItem[];
}

/**
 * PR review failed with error
 */
export interface ReviewErrorResponse {
  prNumber: number;
  error: string;
}

// ============================================
// Validation Payloads
// ============================================

/**
 * Payload to start a validation
 */
export interface ValidationStartPayload {
  projectPath: string;
  issueNumber: number;
}

/**
 * Payload to cancel a running validation
 */
export interface ValidationCancelPayload {
  issueNumber: number;
}

// ============================================
// Validation Responses
// ============================================

/**
 * Progress update during validation
 */
export interface ValidationProgressResponse {
  issueNumber: number;
  step: ValidationStep;
}

/**
 * Validation completed successfully
 */
export interface ValidationCompleteResponse {
  issueNumber: number;
  result: ValidationResult;
}

/**
 * Validation failed with error
 */
export interface ValidationErrorResponse {
  issueNumber: number;
  error: string;
}

/**
 * Queue state update
 */
export interface ValidationQueueUpdateResponse {
  queue: ValidationQueueItem[];
}

// ============================================
// Validation History Payloads
// ============================================

/**
 * Payload to list validation history for a repository
 */
export interface ValidationHistoryListPayload {
  repositoryFullName: string;
  limit?: number;
}

/**
 * Response for listing validation history
 */
export interface ValidationHistoryListResponse {
  entries: ValidationHistoryEntry[];
  error?: string;
}

/**
 * Payload to get the latest validation for a specific issue
 */
export interface ValidationHistoryGetPayload {
  issueNumber: number;
  repositoryFullName: string;
}

/**
 * Response for getting a specific validation history entry
 */
export interface ValidationHistoryGetResponse {
  entry: ValidationHistoryEntry | null;
  error?: string;
}

/**
 * Payload to delete a validation history entry
 */
export interface ValidationHistoryDeletePayload {
  id: string;
}

// ============================================
// Validation Log Payloads
// ============================================

/**
 * Payload to request recent log entries
 */
export interface ValidationLogEntriesPayload {
  limit?: number;
}

/**
 * Response containing recent log entries
 */
export interface ValidationLogEntriesResponse {
  entries: LogEntry[];
  error?: string;
}

// ============================================
// Provider Responses
// ============================================

/**
 * Status of all registered providers
 */
export interface ProviderStatusResponse {
  providers: ProviderStatus[];
}

// ============================================
// GitHub PR Review Payloads
// ============================================

/**
 * Payload to create a PR review with inline comments
 */
export interface GithubCreatePrReviewPayload {
  projectPath: string;
  prNumber: number;
  body: string;
  event: 'REQUEST_CHANGES' | 'COMMENT';
  comments: Array<{
    path: string;
    line: number;
    body: string;
  }>;
}

/**
 * Response for creating a PR review
 */
export interface GithubCreatePrReviewResponse {
  success: boolean;
  url?: string;
  postedComments?: number;
  skippedComments?: number;
  error?: string;
}

// ============================================
// GitHub Comment Payloads
// ============================================

/**
 * Payload to create a comment on an issue
 */
export interface GithubCreateCommentPayload {
  projectPath: string;
  issueNumber: number;
  body: string;
}

/**
 * Response for creating an issue comment
 */
export interface GithubCreateCommentResponse {
  success: boolean;
  commentUrl?: string;
  error?: string;
}

/**
 * Payload to list comments on an issue
 */
export interface GithubListCommentsPayload {
  projectPath: string;
  issueNumber: number;
}

/**
 * Response for listing issue comments
 */
export interface GithubListCommentsResponse {
  comments: IssueComment[];
  error?: string;
}

/**
 * Payload to update an existing comment
 */
export interface GithubUpdateCommentPayload {
  projectPath: string;
  commentId: string;
  body: string;
}

/**
 * Response for updating a comment
 */
export interface GithubUpdateCommentResponse {
  success: boolean;
  commentUrl?: string;
  error?: string;
}
