import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createLogger } from '@gitchorus/shared';
import type {
  PullRequest,
  ValidationStep,
  ReviewResult,
  ReviewHistoryEntry,
  ReviewStatus as SharedReviewStatus,
} from '@gitchorus/shared';

const logger = createLogger('ReviewStore');

// ============================================
// Sort Types
// ============================================

export type PRSortBy = 'updated' | 'created' | 'comments';

// ============================================
// Review Status (re-export shared type)
// ============================================

export type ReviewStatus = SharedReviewStatus;

// ============================================
// State Interface
// ============================================

interface ReviewState {
  /** All pull requests fetched from GitHub */
  pullRequests: PullRequest[];
  /** Whether PRs are currently being fetched */
  loading: boolean;
  /** Whether PRs have been fetched at least once */
  hasFetched: boolean;
  /** Error from last fetch attempt */
  error: string | null;
  /** Currently selected PR number (null if none) */
  selectedPrNumber: number | null;
  /** Current sort order */
  sortBy: PRSortBy;
  /** Filter by PR state */
  filterState: 'open' | 'closed' | 'all';
  /** Review status per PR number */
  reviewStatus: Map<number, ReviewStatus>;
  /** Review progress steps per PR number */
  reviewSteps: Map<number, ValidationStep[]>;
  /** Review results per PR number */
  reviewResults: Map<number, ReviewResult>;
  /** Review errors per PR number */
  reviewErrors: Map<number, string>;
  /** Persisted review history entries */
  reviewHistory: ReviewHistoryEntry[];
  /** Whether history is being loaded */
  historyLoading: boolean;
  /** Review chains per PR number (chronological order, oldest first) */
  reviewChains: Map<number, ReviewHistoryEntry[]>;
}

// ============================================
// Actions Interface
// ============================================

interface ReviewActions {
  /** Set pull requests after successful fetch */
  setPullRequests: (pullRequests: PullRequest[]) => void;
  /** Set selected PR number */
  setSelectedPr: (prNumber: number | null) => void;
  /** Change sort order */
  setSortBy: (sortBy: PRSortBy) => void;
  /** Change filter state */
  setFilterState: (filterState: 'open' | 'closed' | 'all') => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Set review status for a PR */
  setReviewStatus: (prNumber: number, status: ReviewStatus) => void;
  /** Add a review progress step */
  addReviewStep: (prNumber: number, step: ValidationStep) => void;
  /** Set review result for a PR */
  setReviewResult: (prNumber: number, result: ReviewResult) => void;
  /** Set review error for a PR */
  setReviewError: (prNumber: number, error: string) => void;
  /** Clear review state for a PR (steps, result, error) */
  clearReview: (prNumber: number) => void;
  /** Clear all PR data */
  clearPullRequests: () => void;
  /** Set review history entries */
  setReviewHistory: (entries: ReviewHistoryEntry[]) => void;
  /** Set history loading state */
  setHistoryLoading: (loading: boolean) => void;
  /** Remove a single history entry by ID */
  removeHistoryEntry: (id: string) => void;
  /** Set the review chain for a PR */
  setReviewChain: (prNumber: number, chain: ReviewHistoryEntry[]) => void;
  /** Clear review chain for a specific PR */
  clearReviewChain: (prNumber: number) => void;
  /** Clear review state for a re-review (steps + errors only, preserve result until new one arrives) */
  clearReviewForReReview: (prNumber: number) => void;
}

// ============================================
// Combined Store Type
// ============================================

type ReviewStore = ReviewState & ReviewActions;

// ============================================
// Store
// ============================================

export const useReviewStore = create<ReviewStore>()(
  devtools(
    set => ({
      // Initial state
      // loading starts true so views show skeletons until first fetch completes
      pullRequests: [],
      loading: true,
      hasFetched: false,
      error: null,
      selectedPrNumber: null,
      sortBy: 'updated',
      filterState: 'open',
      reviewStatus: new Map(),
      reviewSteps: new Map(),
      reviewResults: new Map(),
      reviewErrors: new Map(),
      reviewHistory: [],
      historyLoading: false,
      reviewChains: new Map(),

      // Actions
      setPullRequests: (pullRequests: PullRequest[]) => {
        logger.info(`Loaded ${pullRequests.length} pull requests`);
        set(
          { pullRequests, loading: false, hasFetched: true, error: null },
          undefined,
          'review/setPullRequests'
        );
      },

      setSelectedPr: (prNumber: number | null) => {
        set({ selectedPrNumber: prNumber }, undefined, 'review/setSelectedPr');
      },

      setSortBy: (sortBy: PRSortBy) => {
        set({ sortBy }, undefined, 'review/setSortBy');
      },

      setFilterState: (filterState: 'open' | 'closed' | 'all') => {
        set({ filterState }, undefined, 'review/setFilterState');
      },

      setLoading: (loading: boolean) => {
        set({ loading }, undefined, 'review/setLoading');
      },

      setError: (error: string | null) => {
        if (error) {
          logger.warn('PR fetch error:', error);
          set({ error, loading: false, hasFetched: true }, undefined, 'review/setError');
        } else {
          set({ error: null }, undefined, 'review/clearError');
        }
      },

      setReviewStatus: (prNumber: number, status: ReviewStatus) => {
        set(
          state => {
            const updated = new Map(state.reviewStatus);
            updated.set(prNumber, status);
            return { reviewStatus: updated };
          },
          undefined,
          'review/setReviewStatus'
        );
      },

      addReviewStep: (prNumber: number, step: ValidationStep) => {
        set(
          state => {
            const updated = new Map(state.reviewSteps);
            const existing = updated.get(prNumber) || [];
            updated.set(prNumber, [...existing, step]);
            return { reviewSteps: updated };
          },
          undefined,
          'review/addReviewStep'
        );
      },

      setReviewResult: (prNumber: number, result: ReviewResult) => {
        logger.info(`Review complete for PR #${prNumber}: ${result.verdict}`);
        set(
          state => {
            const updated = new Map(state.reviewResults);
            updated.set(prNumber, result);
            return { reviewResults: updated };
          },
          undefined,
          'review/setReviewResult'
        );
      },

      setReviewError: (prNumber: number, error: string) => {
        logger.warn(`Review error for PR #${prNumber}: ${error}`);
        set(
          state => {
            const updated = new Map(state.reviewErrors);
            updated.set(prNumber, error);
            return { reviewErrors: updated };
          },
          undefined,
          'review/setReviewError'
        );
      },

      clearReview: (prNumber: number) => {
        set(
          state => {
            const steps = new Map(state.reviewSteps);
            const results = new Map(state.reviewResults);
            const errors = new Map(state.reviewErrors);
            steps.delete(prNumber);
            results.delete(prNumber);
            errors.delete(prNumber);
            return { reviewSteps: steps, reviewResults: results, reviewErrors: errors };
          },
          undefined,
          'review/clearReview'
        );
      },

      setReviewHistory: (entries: ReviewHistoryEntry[]) => {
        logger.info(`Loaded ${entries.length} review history entries`);
        set(
          { reviewHistory: entries, historyLoading: false },
          undefined,
          'review/setReviewHistory'
        );
      },

      setHistoryLoading: (loading: boolean) => {
        set({ historyLoading: loading }, undefined, 'review/setHistoryLoading');
      },

      removeHistoryEntry: (id: string) => {
        set(
          state => ({
            reviewHistory: state.reviewHistory.filter(e => e.id !== id),
          }),
          undefined,
          'review/removeHistoryEntry'
        );
      },

      setReviewChain: (prNumber: number, chain: ReviewHistoryEntry[]) => {
        set(
          state => {
            const updated = new Map(state.reviewChains);
            updated.set(prNumber, chain);
            return { reviewChains: updated };
          },
          undefined,
          'review/setReviewChain'
        );
      },

      clearReviewChain: (prNumber: number) => {
        set(
          state => {
            const updated = new Map(state.reviewChains);
            updated.delete(prNumber);
            return { reviewChains: updated };
          },
          undefined,
          'review/clearReviewChain'
        );
      },

      clearReviewForReReview: (prNumber: number) => {
        set(
          state => {
            const steps = new Map(state.reviewSteps);
            const errors = new Map(state.reviewErrors);
            steps.delete(prNumber);
            errors.delete(prNumber);
            // NOTE: we intentionally keep reviewResults so the old review stays visible
            return { reviewSteps: steps, reviewErrors: errors };
          },
          undefined,
          'review/clearReviewForReReview'
        );
      },

      clearPullRequests: () => {
        logger.info('Clearing pull requests');
        set(
          {
            pullRequests: [],
            loading: true,
            hasFetched: false,
            error: null,
            selectedPrNumber: null,
            reviewStatus: new Map(),
            reviewSteps: new Map(),
            reviewResults: new Map(),
            reviewErrors: new Map(),
            reviewHistory: [],
            historyLoading: false,
            reviewChains: new Map(),
          },
          undefined,
          'review/clearPullRequests'
        );
      },
    }),
    { name: 'review' }
  )
);

// ============================================
// Selectors
// ============================================

/** Select all PRs (unfiltered, unsorted) */
export const selectPullRequests = (state: ReviewStore) => state.pullRequests;

/** Select loading state */
export const selectPRsLoading = (state: ReviewStore) => state.loading;

/** Select error */
export const selectPRsError = (state: ReviewStore) => state.error;

/** Select current sort order */
export const selectPRSortBy = (state: ReviewStore) => state.sortBy;

/** Select filter state */
export const selectPRFilterState = (state: ReviewStore) => state.filterState;

/** Select currently selected PR number */
export const selectSelectedPrNumber = (state: ReviewStore) => state.selectedPrNumber;

/**
 * Select sorted PRs (default: recently updated).
 */
export const selectSortedPRs = (state: ReviewStore): PullRequest[] => {
  const sorted = [...state.pullRequests];

  switch (state.sortBy) {
    case 'updated':
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
    case 'created':
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'comments':
      // PRs don't have commentsCount, so sort by changedFiles as a proxy for activity
      sorted.sort((a, b) => b.changedFiles - a.changedFiles);
      break;
  }

  return sorted;
};

/**
 * Select the currently selected PR object.
 */
export const selectSelectedPR = (state: ReviewStore): PullRequest | undefined => {
  if (state.selectedPrNumber === null) return undefined;
  return state.pullRequests.find(pr => pr.number === state.selectedPrNumber);
};
