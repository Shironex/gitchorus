/**
 * PR Review Types
 *
 * Defines structured output types for AI-powered PR code review.
 * The AI analyzes the PR diff with full codebase access and produces
 * severity-categorized findings with evidence and suggested fixes.
 */

import type { ProviderType } from './provider';

// ============================================
// Core Enums / Unions
// ============================================

/**
 * Severity levels for review findings (4-level scale)
 */
export type ReviewSeverity = 'critical' | 'major' | 'minor' | 'nit';

/**
 * Category tags for review findings (fixed tag set)
 */
export type ReviewCategory = 'security' | 'logic' | 'performance' | 'style' | 'codebase-fit';

/**
 * Review status for queue tracking
 */
export type ReviewStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

// ============================================
// Finding Types
// ============================================

/**
 * A single finding from the PR review
 */
export interface ReviewFinding {
  /** Severity of the finding */
  severity: ReviewSeverity;
  /** Category tag */
  category: ReviewCategory;
  /** File path where the issue was found */
  file: string;
  /** Line number in the diff (for inline comment placement) */
  line: number;
  /** The problematic code snippet */
  codeSnippet: string;
  /** Explanation of the issue */
  explanation: string;
  /** Suggested fix as a code block with inline comments */
  suggestedFix: string;
  /** One-line summary for the finding */
  title: string;
  /** For re-reviews: whether this finding is new, persisting, or a regression */
  addressingStatus?: 'new' | 'persisting' | 'regression';
}

/**
 * Summary of how a previous finding was addressed in a re-review
 */
export interface AddressedFindingSummary {
  /** Title of the original finding */
  title: string;
  /** Severity of the original finding */
  severity: ReviewSeverity;
  /** Whether the finding was addressed */
  status: 'addressed' | 'partially-addressed' | 'unaddressed' | 'new-issue';
  /** AI explanation of how the finding was addressed or why it wasn't */
  explanation: string;
}

// ============================================
// Review Result
// ============================================

/**
 * Overall review result with all findings and metadata
 */
export interface ReviewResult {
  /** PR number that was reviewed */
  prNumber: number;
  /** PR title for display */
  prTitle: string;
  /** Repository full name (owner/repo) */
  repositoryFullName: string;
  /** All findings from the review */
  findings: ReviewFinding[];
  /** Overall verdict text (e.g., "Generally good with 2 major issues") */
  verdict: string;
  /** Quality score 1-10 */
  qualityScore: number;
  /** ISO timestamp when review completed */
  reviewedAt: string;
  /** Which provider performed the review */
  providerType: ProviderType;
  /** Which model was used */
  model: string;
  /** Cost in USD */
  costUsd: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** HEAD commit SHA at time of review (for detecting new commits) */
  headCommitSha?: string;
  /** Review sequence number: 1 for initial, 2+ for re-reviews */
  reviewSequence?: number;
  /** Links to the previous ReviewHistoryEntry.id (creates chain) */
  previousReviewId?: string;
  /** Whether this was a re-review with previous context */
  isReReview?: boolean;
  /** Score from the previous review (for delta display) */
  previousScore?: number;
  /** AI-determined status of findings from the previous review */
  addressedFindings?: AddressedFindingSummary[];
  /** Whether this result was imported from a GitHub review rather than run locally */
  isImported?: boolean;
}

// ============================================
// Queue Types
// ============================================

/**
 * An item in the review queue
 */
export interface ReviewQueueItem {
  /** PR number being reviewed */
  prNumber: number;
  /** Current status in the queue */
  status: ReviewStatus;
  /** Review result (populated when completed) */
  result?: ReviewResult;
  /** Error message (populated when failed) */
  error?: string;
  /** ISO timestamp when queued */
  queuedAt: string;
  /** ISO timestamp when review started */
  startedAt?: string;
  /** ISO timestamp when review completed/failed */
  completedAt?: string;
}

// ============================================
// History Types
// ============================================

/**
 * A persisted review result with a unique ID.
 * Stored locally via electron-store for history viewing.
 */
export type ReviewHistoryEntry = ReviewResult & {
  /** Unique identifier for this history entry */
  id: string;
};

/**
 * Filter options for querying review history
 */
export interface ReviewHistoryFilter {
  /** Filter by repository full name (owner/repo) */
  repositoryFullName?: string;
  /** Filter by specific PR number */
  prNumber?: number;
  /** Maximum number of entries to return */
  limit?: number;
}

// ============================================
// Review Parameters
// ============================================

/**
 * Parameters passed to a provider's review method
 */
export interface ReviewParams {
  /** The PR diff as a string */
  diff: string;
  /** PR number */
  prNumber: number;
  /** PR title */
  prTitle: string;
  /** PR body/description */
  prBody?: string;
  /** Head branch name */
  headBranch: string;
  /** Base branch name */
  baseBranch: string;
  /** Absolute path to the local repository clone */
  repoPath: string;
  /** Repository full name (owner/repo) */
  repoName: string;
  /** Optional provider configuration overrides */
  config?: import('./provider').ProviderConfig;
  /** Optional file transport function for writing logs to disk */
  fileTransport?: (message: string) => void;
  /** Full prior review result for AI context during re-review */
  previousReview?: ReviewResult;
  /** HEAD SHA at time of previous review */
  previousHeadCommitSha?: string;
  /** Whether this is a re-review with previous context */
  isReReview?: boolean;
  /** Diff of changes since the previous review */
  incrementalDiff?: string;
}
