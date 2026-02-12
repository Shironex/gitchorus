import { lazy, Suspense, useState, useEffect } from 'react';
import {
  Play,
  X,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Send,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useIssueStore } from '@/stores/useIssueStore';
import { useValidationStore } from '@/stores/useValidationStore';
import { useValidation } from '@/hooks/useValidation';
import { ValidationStepLog } from './ValidationStepLog';
import { ValidationResults } from './ValidationResults';
import type { ValidationStatus } from '@gitchorus/shared';

const GithubPushPreview = lazy(() => import('./GithubPushPreview'));

/**
 * Side panel that shows validation state for the selected issue.
 *
 * Displays step-by-step progress log, structured results, GitHub push preview,
 * error states with retry, and staleness banner with re-validate prompt.
 * Falls back to history results when no live result is available.
 * After completion, the step log collapses into an "Activity Log" section.
 */
export function ValidationPanel() {
  const { startValidation, cancelValidation, pushToGithub, updateGithubComment, listComments } =
    useValidation();

  const selectedIssueNumber = useIssueStore(state => state.selectedIssueNumber);
  const issues = useIssueStore(state => state.issues);

  const queue = useValidationStore(state => state.queue);
  const steps = useValidationStore(state =>
    selectedIssueNumber ? state.steps.get(selectedIssueNumber) : undefined
  );
  const liveResult = useValidationStore(state =>
    selectedIssueNumber ? state.results.get(selectedIssueNumber) : undefined
  );
  const error = useValidationStore(state =>
    selectedIssueNumber ? state.errors.get(selectedIssueNumber) : undefined
  );

  // Get latest validation (live or history) for display and staleness — inline to avoid new closure per render
  const latestValidation = useValidationStore(state => {
    if (selectedIssueNumber === null) return undefined;
    const live = state.results.get(selectedIssueNumber);
    if (live) return live;
    return state.history.find(e => e.issueNumber === selectedIssueNumber);
  });

  // Use live result if available, otherwise fall back to history
  const result = liveResult || latestValidation;
  const isFromHistory = !liveResult && !!latestValidation;

  // Push modal state
  const [showPushModal, setShowPushModal] = useState(false);
  const pushStatus = useValidationStore(state =>
    selectedIssueNumber ? state.pushStatus.get(selectedIssueNumber) || 'idle' : 'idle'
  );
  const postedUrl = useValidationStore(state =>
    selectedIssueNumber ? state.postedCommentUrls.get(selectedIssueNumber) : undefined
  );

  // Collapsible activity log state — collapsed by default after completion
  const [logExpanded, setLogExpanded] = useState(false);

  // Reset logExpanded when issue changes
  useEffect(() => {
    setLogExpanded(false);
  }, [selectedIssueNumber]);

  if (selectedIssueNumber === null) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Select an issue to validate</p>
      </div>
    );
  }

  const issue = issues.find(i => i.number === selectedIssueNumber);
  if (!issue) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Issue not found</p>
      </div>
    );
  }

  // Get queue status for this issue
  const queueItem = queue.find(q => q.issueNumber === selectedIssueNumber);
  const status: ValidationStatus = queueItem?.status || 'idle';
  const isRunning = status === 'running';
  const isQueued = status === 'queued';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isCancelled = status === 'cancelled';
  const hasResult = !!result;
  const isIdle = status === 'idle' && !liveResult && !latestValidation && !error;
  const canRevalidate = isCompleted || isFailed || isCancelled || isFromHistory;

  // Staleness detection: issue updated after last validation
  const isStale =
    !!result && new Date(issue.updatedAt).getTime() > new Date(result.validatedAt).getTime();

  // Whether to show step log as active (open, not collapsible) or as collapsible
  const hasSteps = steps && steps.length > 0;
  const showActiveLog = hasSteps && isRunning;
  const showCollapsibleLog = hasSteps && !isRunning;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-mono">#{issue.number}</p>
            <h3 className="text-sm font-semibold text-foreground leading-tight truncate">
              {issue.title}
            </h3>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {(isIdle || canRevalidate) && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => startValidation(selectedIssueNumber)}
              >
                {canRevalidate ? (
                  <>
                    <RefreshCw size={12} /> Re-validate
                  </>
                ) : (
                  <>
                    <Play size={12} /> Validate
                  </>
                )}
              </Button>
            )}
            {(isRunning || isQueued) && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => cancelValidation(selectedIssueNumber)}
              >
                <X size={12} /> Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Status indicator */}
        {isQueued && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />
            <span>Waiting in queue...</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Content */}
      <div data-testid="validation-content" className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Error state — shown at top for immediate visibility */}
        {(isFailed || (error && !isRunning)) && error && (
          <div className="rounded-lg border p-3 border-destructive/30 bg-destructive/5">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-destructive">Validation failed</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs mt-2 text-destructive hover:text-destructive"
                  onClick={() => startValidation(selectedIssueNumber)}
                >
                  <RefreshCw size={12} className="mr-1" /> Retry
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Staleness banner */}
        {isStale && hasResult && !isRunning && !isQueued && (
          <div className="rounded-lg border p-3 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={14}
                className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
              />
              <div className="flex-1">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Results may be outdated
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This issue was updated after the last validation.
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs mt-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                  onClick={() => startValidation(selectedIssueNumber)}
                >
                  <RefreshCw size={12} className="mr-1" /> Re-validate
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* History notice */}
        {isFromHistory && !isStale && !isRunning && !isQueued && (
          <div className="rounded-lg border p-2.5 border-muted bg-muted/20">
            <p className="text-[11px] text-muted-foreground">
              Showing results from a previous validation.
            </p>
          </div>
        )}

        {/* Active step log — shown open while running */}
        {showActiveLog && (
          <div>
            <h4 className="text-xs font-medium text-foreground mb-2">Progress</h4>
            <ValidationStepLog steps={steps} isRunning={isRunning} />
          </div>
        )}

        {/* Collapsible activity log — shown after completion */}
        {showCollapsibleLog && (
          <div>
            <button
              onClick={() => setLogExpanded(!logExpanded)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left"
            >
              {logExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>Activity Log ({steps.length} steps)</span>
            </button>
            {logExpanded && (
              <div className="mt-2">
                <ValidationStepLog steps={steps} isRunning={false} />
              </div>
            )}
          </div>
        )}

        {/* Running indicator when no steps yet */}
        {isRunning && (!steps || steps.length === 0) && (
          <div className="flex items-center gap-2 py-8 justify-center">
            <Loader2 size={16} className="animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Starting validation...</span>
          </div>
        )}

        {/* Results */}
        {hasResult && result && (
          <>
            <Separator />
            <div>
              <h4 className="text-xs font-medium text-foreground mb-2">Results</h4>
              <ValidationResults result={result} />
            </div>
          </>
        )}

        {/* GitHub push */}
        {hasResult && result && (
          <>
            <Separator />
            <div>
              <h4 className="text-xs font-medium text-foreground mb-2">Push to GitHub</h4>
              {pushStatus === 'posted' && postedUrl ? (
                <div className="flex items-center gap-2 py-2">
                  <Check size={14} className="text-green-500" />
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    Posted
                  </span>
                  <a
                    href={postedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    View on GitHub <ExternalLink size={10} />
                  </a>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowPushModal(true)}
                >
                  <Send size={12} /> Push to GitHub
                </Button>
              )}
            </div>
          </>
        )}

        {/* Push modal (lazy loaded, only mounted when open) */}
        {showPushModal && hasResult && result && (
          <Suspense
            fallback={
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                <Loader2 size={24} className="animate-spin text-muted-foreground" />
              </div>
            }
          >
            <GithubPushPreview
              open={showPushModal}
              onOpenChange={setShowPushModal}
              issueNumber={selectedIssueNumber}
              result={result}
              onPush={pushToGithub}
              onUpdate={updateGithubComment}
              onListComments={listComments}
            />
          </Suspense>
        )}

        {/* Cancelled state */}
        {isCancelled && !error && (
          <div className="rounded-lg border p-3 border-muted bg-muted/30">
            <p className="text-xs text-muted-foreground">Validation was cancelled.</p>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs mt-1"
              onClick={() => startValidation(selectedIssueNumber)}
            >
              <RefreshCw size={12} className="mr-1" /> Run again
            </Button>
          </div>
        )}

        {/* Empty idle state */}
        {isIdle && !error && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">No validation results yet</p>
            <p className="text-xs mt-1">
              Click <strong>Validate</strong> to analyze this issue
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
