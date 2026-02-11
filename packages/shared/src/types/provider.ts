/**
 * AI Provider Abstraction Types
 *
 * Defines the provider layer for AI-powered analysis.
 * Currently supports Claude Agent SDK, extensible for future providers.
 */

import type { Issue } from './github';

// ============================================
// Provider Types
// ============================================

/**
 * Supported AI provider types
 */
export type ProviderType = 'claude';

/**
 * Provider availability and authentication status
 */
export interface ProviderStatus {
  /** Provider type identifier */
  type: ProviderType;
  /** Whether the provider CLI/SDK is available on this machine */
  available: boolean;
  /** Provider CLI version if available */
  version?: string;
  /** Whether the provider is authenticated and ready to use */
  authenticated: boolean;
  /** Error message if provider is unavailable */
  error?: string;
}

/**
 * Configuration for a provider invocation
 */
export interface ProviderConfig {
  /** Provider type to use */
  type: ProviderType;
  /** Model to use (provider-specific) */
  model?: string;
  /** Maximum number of agent turns */
  maxTurns?: number;
  /** Maximum budget in USD for this invocation */
  maxBudgetUsd?: number;
}

// ============================================
// Validation Parameters
// ============================================

/**
 * Parameters passed to a provider's validate method
 */
export interface ValidationParams {
  /** The GitHub issue to validate */
  issue: Issue;
  /** Absolute path to the local repository clone */
  repoPath: string;
  /** Repository full name (owner/repo) */
  repoName: string;
  /** Optional provider configuration overrides */
  config?: ProviderConfig;
  /** Optional file transport function for writing logs to disk */
  fileTransport?: (message: string) => void;
}

// ============================================
// Base Provider Interface
// ============================================

/**
 * Base interface that all AI providers must implement.
 *
 * The validate method is an async generator that yields progress steps
 * and returns the final validation result.
 */
export interface BaseProvider {
  /** Check if the provider is available and authenticated */
  getStatus(): Promise<ProviderStatus>;

  /**
   * Run validation on an issue.
   * Yields ValidationStep events for progress tracking.
   * Returns the final ValidationResult.
   */
  validate(
    params: ValidationParams
  ): AsyncGenerator<
    import('./validation').ValidationStep,
    import('./validation').ValidationResult
  >;
}

// ============================================
// Claude CLI Status
// ============================================

/**
 * Claude CLI detection and authentication status
 */
export interface ClaudeCliStatus {
  /** Whether the Claude CLI is installed */
  installed: boolean;
  /** Absolute path to the Claude CLI executable */
  path?: string;
  /** Claude CLI version string */
  version?: string;
  /** How the CLI was found ('path' = in PATH, 'local' = known installation path) */
  method?: 'path' | 'local';
  /** Operating system platform */
  platform: string;
  /** CPU architecture */
  arch: string;
  /** Authentication status */
  auth: { authenticated: boolean };
}
