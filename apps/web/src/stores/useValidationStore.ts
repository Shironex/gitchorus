import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createLogger } from '@gitchorus/shared';
import type {
  ValidationStep,
  ValidationResult,
  ValidationQueueItem,
  ValidationStatus,
  ValidationHistoryEntry,
} from '@gitchorus/shared';

const logger = createLogger('ValidationStore');

// ============================================
// Push Status
// ============================================

export type PushStatus = 'idle' | 'editing' | 'pushing' | 'posted';

// ============================================
// State Interface
// ============================================

interface ValidationState {
  /** Queue items from the backend */
  queue: ValidationQueueItem[];
  /** Validation steps per issue number */
  steps: Map<number, ValidationStep[]>;
  /** Validation results per issue number */
  results: Map<number, ValidationResult>;
  /** Validation errors per issue number */
  errors: Map<number, string>;
  /** GitHub push status per issue number */
  pushStatus: Map<number, PushStatus>;
  /** Posted comment URLs per issue number */
  postedCommentUrls: Map<number, string>;
  /** Posted comment IDs per issue number (for update support) */
  postedCommentIds: Map<number, string>;
  /** Validation history entries from electron-store persistence */
  history: ValidationHistoryEntry[];
  /** Whether history is currently being loaded */
  historyLoading: boolean;
}

// ============================================
// Actions Interface
// ============================================

interface ValidationActions {
  /** Update the full queue state */
  updateQueue: (queue: ValidationQueueItem[]) => void;
  /** Add a step for an issue */
  addStep: (issueNumber: number, step: ValidationStep) => void;
  /** Set the result for an issue */
  setResult: (issueNumber: number, result: ValidationResult) => void;
  /** Set an error for an issue */
  setError: (issueNumber: number, error: string) => void;
  /** Clear steps for an issue (e.g., before re-run) */
  clearSteps: (issueNumber: number) => void;
  /** Set push status for an issue */
  setPushStatus: (issueNumber: number, status: PushStatus) => void;
  /** Set posted comment URL after successful push */
  setPostedCommentUrl: (issueNumber: number, url: string) => void;
  /** Set posted comment ID after successful push */
  setPostedCommentId: (issueNumber: number, commentId: string) => void;
  /** Set history entries */
  setHistory: (entries: ValidationHistoryEntry[]) => void;
  /** Set history loading state */
  setHistoryLoading: (loading: boolean) => void;
  /** Remove a specific history entry by ID */
  removeHistoryEntry: (id: string) => void;
  /** Clear all validation state */
  clearAll: () => void;
}

// ============================================
// Combined Store Type
// ============================================

type ValidationStore = ValidationState & ValidationActions;

// ============================================
// Store
// ============================================

export const useValidationStore = create<ValidationStore>()(
  devtools(
    (set) => ({
      // Initial state
      queue: [],
      steps: new Map(),
      results: new Map(),
      errors: new Map(),
      pushStatus: new Map(),
      postedCommentUrls: new Map(),
      postedCommentIds: new Map(),
      history: [],
      historyLoading: false,

      // Actions
      updateQueue: (queue: ValidationQueueItem[]) => {
        logger.debug(`Queue updated: ${queue.length} items`);
        set({ queue }, undefined, 'validation/updateQueue');
      },

      addStep: (issueNumber: number, step: ValidationStep) => {
        set(
          (state) => {
            const updated = new Map(state.steps);
            const existing = updated.get(issueNumber) || [];
            updated.set(issueNumber, [...existing, step]);
            return { steps: updated };
          },
          undefined,
          'validation/addStep'
        );
      },

      setResult: (issueNumber: number, result: ValidationResult) => {
        logger.info(`Validation result for #${issueNumber}: ${result.verdict} (${result.confidence}%)`);
        set(
          (state) => {
            const updated = new Map(state.results);
            updated.set(issueNumber, result);
            return { results: updated };
          },
          undefined,
          'validation/setResult'
        );
      },

      setError: (issueNumber: number, error: string) => {
        logger.warn(`Validation error for #${issueNumber}: ${error}`);
        set(
          (state) => {
            const updated = new Map(state.errors);
            updated.set(issueNumber, error);
            return { errors: updated };
          },
          undefined,
          'validation/setError'
        );
      },

      clearSteps: (issueNumber: number) => {
        set(
          (state) => {
            const updatedSteps = new Map(state.steps);
            updatedSteps.delete(issueNumber);
            const updatedErrors = new Map(state.errors);
            updatedErrors.delete(issueNumber);
            const updatedResults = new Map(state.results);
            updatedResults.delete(issueNumber);
            const updatedPush = new Map(state.pushStatus);
            updatedPush.delete(issueNumber);
            return {
              steps: updatedSteps,
              errors: updatedErrors,
              results: updatedResults,
              pushStatus: updatedPush,
            };
          },
          undefined,
          'validation/clearSteps'
        );
      },

      setPushStatus: (issueNumber: number, status: PushStatus) => {
        set(
          (state) => {
            const updated = new Map(state.pushStatus);
            updated.set(issueNumber, status);
            return { pushStatus: updated };
          },
          undefined,
          'validation/setPushStatus'
        );
      },

      setPostedCommentUrl: (issueNumber: number, url: string) => {
        set(
          (state) => {
            const updated = new Map(state.postedCommentUrls);
            updated.set(issueNumber, url);
            return { postedCommentUrls: updated };
          },
          undefined,
          'validation/setPostedCommentUrl'
        );
      },

      setPostedCommentId: (issueNumber: number, commentId: string) => {
        set(
          (state) => {
            const updated = new Map(state.postedCommentIds);
            updated.set(issueNumber, commentId);
            return { postedCommentIds: updated };
          },
          undefined,
          'validation/setPostedCommentId'
        );
      },

      setHistory: (entries: ValidationHistoryEntry[]) => {
        logger.debug(`History loaded: ${entries.length} entries`);
        set({ history: entries, historyLoading: false }, undefined, 'validation/setHistory');
      },

      setHistoryLoading: (loading: boolean) => {
        set({ historyLoading: loading }, undefined, 'validation/setHistoryLoading');
      },

      removeHistoryEntry: (id: string) => {
        set(
          (state) => ({
            history: state.history.filter((e) => e.id !== id),
          }),
          undefined,
          'validation/removeHistoryEntry'
        );
      },

      clearAll: () => {
        logger.info('Clearing all validation state');
        set(
          {
            queue: [],
            steps: new Map(),
            results: new Map(),
            errors: new Map(),
            pushStatus: new Map(),
            postedCommentUrls: new Map(),
            postedCommentIds: new Map(),
            history: [],
            historyLoading: false,
          },
          undefined,
          'validation/clearAll'
        );
      },
    }),
    { name: 'validation' }
  )
);

// ============================================
// Selectors
// ============================================

/** Get queue status for a specific issue */
export const selectQueueStatus = (issueNumber: number) => (state: ValidationStore): ValidationStatus | undefined => {
  const item = state.queue.find((q) => q.issueNumber === issueNumber);
  return item?.status;
};

/** Get steps for a specific issue */
export const selectSteps = (issueNumber: number) => (state: ValidationStore): ValidationStep[] => {
  return state.steps.get(issueNumber) || [];
};

/** Get result for a specific issue */
export const selectResult = (issueNumber: number) => (state: ValidationStore): ValidationResult | undefined => {
  return state.results.get(issueNumber);
};

/** Get error for a specific issue */
export const selectValidationError = (issueNumber: number) => (state: ValidationStore): string | undefined => {
  return state.errors.get(issueNumber);
};

/** Get push status for a specific issue */
export const selectPushStatus = (issueNumber: number) => (state: ValidationStore): PushStatus => {
  return state.pushStatus.get(issueNumber) || 'idle';
};

/** Get posted comment URL for a specific issue */
export const selectPostedCommentUrl = (issueNumber: number) => (state: ValidationStore): string | undefined => {
  return state.postedCommentUrls.get(issueNumber);
};

/** Get the latest validation for an issue — checks live results first, then history */
export const selectLatestValidationForIssue = (issueNumber: number) => (state: ValidationStore): ValidationResult | ValidationHistoryEntry | undefined => {
  // Live result takes priority
  const liveResult = state.results.get(issueNumber);
  if (liveResult) return liveResult;

  // Fall back to history
  const historyEntry = state.history.find((e) => e.issueNumber === issueNumber);
  return historyEntry;
};
