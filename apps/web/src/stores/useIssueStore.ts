import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createLogger } from '@gitchorus/shared';
import type { Issue, IssueLabel, ValidationStatus } from '@gitchorus/shared';

const logger = createLogger('IssueStore');

// ============================================
// Sort Types
// ============================================

export type IssueSortBy = 'newest' | 'oldest' | 'most-commented';

// ============================================
// State Interface
// ============================================

interface IssueState {
  /** All issues fetched from GitHub */
  issues: Issue[];
  /** Whether issues are currently being fetched */
  isLoading: boolean;
  /** Whether issues have been fetched at least once */
  hasFetched: boolean;
  /** Error from last fetch attempt */
  error: string | null;
  /** Current sort order */
  sortBy: IssueSortBy;
  /** Label names currently active as filters */
  filterLabels: string[];
  /** All unique labels available across all issues */
  availableLabels: IssueLabel[];
  /** Currently selected issue number (null if none) */
  selectedIssueNumber: number | null;
  /** Validation status per issue number */
  validationStatuses: Map<number, ValidationStatus>;
}

// ============================================
// Actions Interface
// ============================================

interface IssueActions {
  /** Set issues after successful fetch */
  setIssues: (issues: Issue[]) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Change sort order */
  setSortBy: (sortBy: IssueSortBy) => void;
  /** Toggle a label in the filter (add if missing, remove if present) */
  toggleLabelFilter: (labelName: string) => void;
  /** Select an issue by number */
  setSelectedIssue: (issueNumber: number | null) => void;
  /** Clear all issues (e.g., on disconnect) */
  clearIssues: () => void;
  /** Set validation status for an issue */
  setValidationStatus: (issueNumber: number, status: ValidationStatus) => void;
}

// ============================================
// Combined Store Type
// ============================================

type IssueStore = IssueState & IssueActions;

/**
 * Extract unique labels from a list of issues
 */
function extractUniqueLabels(issues: Issue[]): IssueLabel[] {
  const labelMap = new Map<string, IssueLabel>();
  for (const issue of issues) {
    for (const label of issue.labels) {
      if (!labelMap.has(label.name)) {
        labelMap.set(label.name, label);
      }
    }
  }
  return Array.from(labelMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================
// Store
// ============================================

export const useIssueStore = create<IssueStore>()(
  devtools(
    set => ({
      // Initial state — isLoading starts true so views show skeletons until first fetch completes
      issues: [],
      isLoading: true,
      hasFetched: false,
      error: null,
      sortBy: 'newest',
      filterLabels: [],
      availableLabels: [],
      selectedIssueNumber: null,
      validationStatuses: new Map(),

      // Actions
      setIssues: (issues: Issue[]) => {
        logger.info(`Loaded ${issues.length} issues`);
        set(
          {
            issues,
            availableLabels: extractUniqueLabels(issues),
            isLoading: false,
            hasFetched: true,
            error: null,
          },
          undefined,
          'issues/setIssues'
        );
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading }, undefined, 'issues/setLoading');
      },

      setError: (error: string | null) => {
        if (error) {
          logger.warn('Issue fetch error:', error);
          set({ error, isLoading: false, hasFetched: true }, undefined, 'issues/setError');
        } else {
          set({ error: null }, undefined, 'issues/clearError');
        }
      },

      setSortBy: (sortBy: IssueSortBy) => {
        set({ sortBy }, undefined, 'issues/setSortBy');
      },

      toggleLabelFilter: (labelName: string) => {
        set(
          state => {
            const current = state.filterLabels;
            const updated = current.includes(labelName)
              ? current.filter(l => l !== labelName)
              : [...current, labelName];
            return { filterLabels: updated };
          },
          undefined,
          'issues/toggleLabelFilter'
        );
      },

      setSelectedIssue: (issueNumber: number | null) => {
        set({ selectedIssueNumber: issueNumber }, undefined, 'issues/setSelectedIssue');
      },

      clearIssues: () => {
        logger.info('Clearing issues');
        set(
          {
            issues: [],
            isLoading: true,
            hasFetched: false,
            error: null,
            filterLabels: [],
            availableLabels: [],
            selectedIssueNumber: null,
            validationStatuses: new Map(),
          },
          undefined,
          'issues/clearIssues'
        );
      },

      setValidationStatus: (issueNumber: number, status: ValidationStatus) => {
        set(
          state => {
            const updated = new Map(state.validationStatuses);
            updated.set(issueNumber, status);
            return { validationStatuses: updated };
          },
          undefined,
          'issues/setValidationStatus'
        );
      },
    }),
    { name: 'issues' }
  )
);

// ============================================
// Selectors
// ============================================

/** Select all issues (unfiltered, unsorted) */
export const selectIssues = (state: IssueStore) => state.issues;

/** Select loading state */
export const selectIssuesLoading = (state: IssueStore) => state.isLoading;

/** Select error */
export const selectIssuesError = (state: IssueStore) => state.error;

/** Select current sort order */
export const selectSortBy = (state: IssueStore) => state.sortBy;

/** Select active label filters */
export const selectFilterLabels = (state: IssueStore) => state.filterLabels;

/** Select available labels */
export const selectAvailableLabels = (state: IssueStore) => state.availableLabels;

/** Select currently selected issue number */
export const selectSelectedIssue = (state: IssueStore) => state.selectedIssueNumber;

/** Select validation statuses map */
export const selectValidationStatuses = (state: IssueStore) => state.validationStatuses;

/**
 * Select filtered and sorted issues.
 * Applies label filter, then sorts by the current sort order.
 */
export const selectFilteredSortedIssues = (state: IssueStore): Issue[] => {
  let filtered = state.issues;

  // Apply label filter
  if (state.filterLabels.length > 0) {
    filtered = filtered.filter(issue =>
      state.filterLabels.some(filterLabel => issue.labels.some(label => label.name === filterLabel))
    );
  }

  // Apply sort
  const sorted = [...filtered];
  switch (state.sortBy) {
    case 'newest':
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'oldest':
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case 'most-commented':
      sorted.sort((a, b) => b.commentsCount - a.commentsCount);
      break;
  }

  return sorted;
};
