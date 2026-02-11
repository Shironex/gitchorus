/**
 * Validation Result Types
 *
 * Defines structured output types for AI-powered issue validation.
 * The AI auto-detects whether an issue is a bug or feature request
 * and produces the appropriate validation result.
 */

import type { ProviderType } from './provider';

// ============================================
// Core Enums / Unions
// ============================================

/**
 * Issue type as detected by AI
 */
export type IssueType = 'bug' | 'feature';

/**
 * Validation verdict — how confident the AI is about the issue
 */
export type ValidationVerdict = 'confirmed' | 'likely' | 'uncertain' | 'unlikely' | 'invalid';

/**
 * Estimated complexity level for resolving the issue
 */
export type ComplexityLevel = 'trivial' | 'low' | 'medium' | 'high' | 'very-high';

/**
 * Status of a validation in the queue
 */
export type ValidationStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

// ============================================
// Validation Components
// ============================================

/**
 * A file affected by the issue, identified by AI analysis
 */
export interface AffectedFile {
  /** Relative path to the file from repo root */
  path: string;
  /** Why this file is affected */
  reason: string;
  /** Relevant code snippet if applicable */
  snippet?: string;
}

/**
 * A progress step emitted during validation
 */
export interface ValidationStep {
  /** Step identifier (e.g., 'reading-issue', 'scanning-files') */
  step: string;
  /** Human-readable progress message */
  message: string;
  /** ISO timestamp when this step occurred */
  timestamp: string;
}

// ============================================
// Validation Result Types
// ============================================

/**
 * Bug validation result — produced when AI detects the issue is a bug report
 */
export interface BugValidation {
  issueType: 'bug';
  /** How confident the AI is that this bug exists */
  verdict: ValidationVerdict;
  /** Confidence percentage (0-100) */
  confidence: number;
  /** Files identified as affected by this bug */
  affectedFiles: AffectedFile[];
  /** Estimated complexity to fix */
  complexity: ComplexityLevel;
  /** Suggested approach to fix the bug */
  suggestedApproach: string;
  /** AI's reasoning for its verdict */
  reasoning: string;
}

/**
 * Feature validation result — produced when AI detects the issue is a feature request
 */
export interface FeatureValidation {
  issueType: 'feature';
  /** How feasible the feature is to implement */
  verdict: ValidationVerdict;
  /** Confidence percentage (0-100) */
  confidence: number;
  /** Files that would need to be modified */
  affectedFiles: AffectedFile[];
  /** Estimated complexity to implement */
  complexity: ComplexityLevel;
  /** Prerequisites that must be in place first */
  prerequisites: string[];
  /** Potential conflicts with existing functionality */
  potentialConflicts: string[];
  /** Estimated effort (e.g., "2-4 hours", "1-2 days") */
  effortEstimate: string;
  /** Suggested implementation approach */
  suggestedApproach: string;
  /** AI's reasoning for its assessment */
  reasoning: string;
}

/**
 * Full validation result with metadata.
 * Discriminated union on issueType field.
 */
export type ValidationResult = (BugValidation | FeatureValidation) & {
  /** Issue number that was validated */
  issueNumber: number;
  /** Issue title for display */
  issueTitle: string;
  /** Repository full name (owner/repo) */
  repositoryFullName: string;
  /** ISO timestamp when validation completed */
  validatedAt: string;
  /** Which provider performed the validation */
  providerType: ProviderType;
  /** Which model was used */
  model: string;
  /** Cost of this validation in USD */
  costUsd: number;
  /** Duration of the validation in milliseconds */
  durationMs: number;
};

// ============================================
// Queue Types
// ============================================

/**
 * An item in the validation queue
 */
export interface ValidationQueueItem {
  /** Issue number being validated */
  issueNumber: number;
  /** Current status in the queue */
  status: ValidationStatus;
  /** Validation result (populated when completed) */
  result?: ValidationResult;
  /** Error message (populated when failed) */
  error?: string;
  /** ISO timestamp when queued */
  queuedAt: string;
  /** ISO timestamp when validation started */
  startedAt?: string;
  /** ISO timestamp when validation completed/failed */
  completedAt?: string;
}
