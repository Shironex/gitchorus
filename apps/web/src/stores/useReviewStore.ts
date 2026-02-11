import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createLogger } from '@gitchorus/shared';
import type { PullRequest } from '@gitchorus/shared';

const logger = createLogger('ReviewStore');

// ============================================
// Sort Types
// ============================================

export type PRSortBy = 'updated' | 'created' | 'comments';

// ============================================
// Review Status
// ============================================

export type ReviewStatus = 'idle' | 'running' | 'completed' | 'failed';

// ============================================
// State Interface
// ============================================

interface ReviewState {
  /** All pull requests fetched from GitHub */
  pullRequests: PullRequest[];
  /** Whether PRs are currently being fetched */
  loading: boolean;
  /** Error from last fetch attempt */
  error: string | null;
  /** Currently selected PR number (null if none) */
  selectedPrNumber: number | null;
  /** Current sort order */
  sortBy: PRSortBy;
  /** Filter by PR state */
  filterState: 'open' | 'closed' | 'all';
  /** Review status per PR number (for plan 02) */
  reviewStatus: Map<number, ReviewStatus>;
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
  /** Clear all PR data */
  clearPullRequests: () => void;
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
    (set) => ({
      // Initial state
      pullRequests: [],
      loading: false,
      error: null,
      selectedPrNumber: null,
      sortBy: 'updated',
      filterState: 'open',
      reviewStatus: new Map(),

      // Actions
      setPullRequests: (pullRequests: PullRequest[]) => {
        logger.info(`Loaded ${pullRequests.length} pull requests`);
        set(
          { pullRequests, loading: false, error: null },
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
        }
        set({ error, loading: false }, undefined, 'review/setError');
      },

      setReviewStatus: (prNumber: number, status: ReviewStatus) => {
        set(
          (state) => {
            const updated = new Map(state.reviewStatus);
            updated.set(prNumber, status);
            return { reviewStatus: updated };
          },
          undefined,
          'review/setReviewStatus'
        );
      },

      clearPullRequests: () => {
        logger.info('Clearing pull requests');
        set(
          {
            pullRequests: [],
            loading: false,
            error: null,
            selectedPrNumber: null,
            reviewStatus: new Map(),
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
  return state.pullRequests.find((pr) => pr.number === state.selectedPrNumber);
};
