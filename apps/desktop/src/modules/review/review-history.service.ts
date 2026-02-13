import { Injectable } from '@nestjs/common';
import Store from 'electron-store';
import { createLogger } from '@gitchorus/shared';
import type { ReviewResult, ReviewHistoryEntry, ReviewHistoryFilter } from '@gitchorus/shared';

const logger = createLogger('ReviewHistoryService');

/** Maximum number of history entries to retain */
const MAX_HISTORY_ENTRIES = 500;

/** Store key for review history */
const STORE_KEY = 'reviewHistory';

/**
 * Generate a unique ID for a history entry.
 * Uses timestamp + PR number + random suffix for uniqueness.
 */
function generateId(prNumber: number): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `rh-${prNumber}-${timestamp}-${random}`;
}

/**
 * Service for persisting review results locally using electron-store.
 *
 * Stores review history entries that survive app restarts.
 * Entries are capped at MAX_HISTORY_ENTRIES (500) to prevent unbounded growth.
 */
@Injectable()
export class ReviewHistoryService {
  private readonly store: Store;

  constructor() {
    this.store = new Store();
    logger.info('Initialized with electron-store persistence');
  }

  /**
   * Save a review result to history.
   * Generates a unique ID and caps storage at MAX_HISTORY_ENTRIES.
   */
  save(result: ReviewResult): ReviewHistoryEntry {
    const entries = this.getAllEntries();

    const entry: ReviewHistoryEntry = {
      ...result,
      id: generateId(result.prNumber),
    };

    // Prepend new entry (newest first)
    entries.unshift(entry);

    // Cap at max entries
    if (entries.length > MAX_HISTORY_ENTRIES) {
      entries.length = MAX_HISTORY_ENTRIES;
      logger.debug(`History capped at ${MAX_HISTORY_ENTRIES} entries`);
    }

    this.store.set(STORE_KEY, entries);
    logger.info(
      `Saved review for PR #${result.prNumber} (${result.repositoryFullName}), total: ${entries.length}`
    );

    return entry;
  }

  /**
   * List history entries with optional filtering.
   * Results are sorted by reviewedAt descending (newest first).
   */
  list(filter: ReviewHistoryFilter = {}): ReviewHistoryEntry[] {
    let entries = this.getAllEntries();

    // Filter by repository
    if (filter.repositoryFullName) {
      entries = entries.filter(e => e.repositoryFullName === filter.repositoryFullName);
    }

    // Filter by PR number
    if (filter.prNumber !== undefined) {
      entries = entries.filter(e => e.prNumber === filter.prNumber);
    }

    // Sort by reviewedAt descending
    entries.sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime());

    // Apply limit
    if (filter.limit && filter.limit > 0) {
      entries = entries.slice(0, filter.limit);
    }

    return entries;
  }

  /**
   * Get the latest review result for a specific PR in a repository.
   */
  getLatestForPR(repositoryFullName: string, prNumber: number): ReviewHistoryEntry | null {
    const entries = this.list({
      repositoryFullName,
      prNumber,
      limit: 1,
    });

    return entries[0] || null;
  }

  /**
   * Get a specific history entry by ID.
   */
  getById(id: string): ReviewHistoryEntry | null {
    const entries = this.getAllEntries();
    return entries.find(e => e.id === id) || null;
  }

  /**
   * Get the review chain for a PR — all reviews sorted by reviewedAt ascending (oldest first).
   * The chain represents the full re-review history for a single PR.
   */
  getReviewChain(
    repositoryFullName: string,
    prNumber: number,
    limit: number = 10
  ): ReviewHistoryEntry[] {
    const entries = this.list({ repositoryFullName, prNumber });

    // list() returns newest-first; use spread to avoid in-place mutation
    const chain = [...entries].reverse();

    // Cap at limit
    if (limit > 0 && chain.length > limit) {
      return chain.slice(-limit);
    }

    return chain;
  }

  /**
   * Delete a specific history entry by ID.
   * Returns true if the entry was found and deleted.
   */
  delete(id: string): boolean {
    const entries = this.getAllEntries();
    const index = entries.findIndex(e => e.id === id);

    if (index === -1) {
      logger.debug(`History entry not found: ${id}`);
      return false;
    }

    entries.splice(index, 1);
    this.store.set(STORE_KEY, entries);
    logger.info(`Deleted history entry: ${id}`);
    return true;
  }

  /**
   * Import a review from GitHub review data.
   * Creates a ReviewHistoryEntry with parsed quality score and verdict
   * so that re-reviews can chain from it on a different machine.
   */
  importFromGithub(params: {
    prNumber: number;
    prTitle: string;
    repositoryFullName: string;
    qualityScore: number;
    verdict: string;
    reviewedAt: string;
    headCommitSha?: string;
  }): ReviewHistoryEntry {
    // Check if we already have a local entry for this PR at this timestamp
    const existing = this.list({
      repositoryFullName: params.repositoryFullName,
      prNumber: params.prNumber,
    });
    const alreadyImported = existing.find(e => e.reviewedAt === params.reviewedAt);
    if (alreadyImported) {
      logger.info(
        `Review for PR #${params.prNumber} already exists locally (imported or ran), skipping import`
      );
      return alreadyImported;
    }

    const result: ReviewResult = {
      prNumber: params.prNumber,
      prTitle: params.prTitle,
      repositoryFullName: params.repositoryFullName,
      findings: [],
      verdict: params.verdict,
      qualityScore: params.qualityScore,
      reviewedAt: params.reviewedAt,
      providerType: 'claude',
      model: 'unknown',
      costUsd: 0,
      durationMs: 0,
      headCommitSha: params.headCommitSha,
      reviewSequence: 1,
      isImported: true,
    };

    const entry = this.save(result);
    logger.info(
      `Imported GitHub review for PR #${params.prNumber} (${params.repositoryFullName}), score: ${params.qualityScore}/10`
    );
    return entry;
  }

  /**
   * Clear all history entries, optionally filtered by repository.
   */
  clear(repositoryFullName?: string): void {
    if (repositoryFullName) {
      const entries = this.getAllEntries().filter(e => e.repositoryFullName !== repositoryFullName);
      this.store.set(STORE_KEY, entries);
      logger.info(`Cleared history for ${repositoryFullName}`);
    } else {
      this.store.set(STORE_KEY, []);
      logger.info('Cleared all history');
    }
  }

  /**
   * Get all entries from the store.
   * Returns an empty array if no entries exist or data is invalid.
   */
  private getAllEntries(): ReviewHistoryEntry[] {
    try {
      const data = this.store.get(STORE_KEY);
      if (Array.isArray(data)) {
        return data as ReviewHistoryEntry[];
      }
      return [];
    } catch (error) {
      logger.error('Failed to read history from store:', error);
      return [];
    }
  }
}
