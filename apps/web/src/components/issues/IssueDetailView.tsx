import { lazy, Suspense, useState, useEffect } from 'react';
import {
  ArrowLeft,
  Play,
  X,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Send,
  Check,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useIssueStore } from '@/stores/useIssueStore';
import { useValidationStore } from '@/stores/useValidationStore';
import { useValidation } from '@/hooks/useValidation';
import { ValidationResults } from '../validation/ValidationResults';
import { AgentActivityHero, CollapsibleActivityLog } from '../agent-activity';
import type { Issue, ValidationStatus } from '@gitchorus/shared';

const GithubPushPreview = lazy(() => import('../validation/GithubPushPreview'));

interface IssueDetailViewProps {
  issue: Issue;
}

/**
 * Full-width detail view for a selected issue.
 *
 * Shows issue details, validation action buttons, streaming progress,
 * structured results, and GitHub push preview.
 * Matches the ReviewView layout pattern for consistency.
 */
export function IssueDetailView({ issue }: IssueDetailViewProps) {
  const { startValidation, cancelValidation, pushToGithub, updateGithubComment, listComments } =
    useValidation();

  const setSelectedIssue = useIssueStore(state => state.setSelectedIssue);
  const issueNumber = issue.number;

  const queue = useValidationStore(state => state.queue);
  const steps = useValidationStore(state => state.steps.get(issueNumber));
  const liveResult = useValidationStore(state => state.results.get(issueNumber));
  const error = useValidationStore(state => state.errors.get(issueNumber));

  // Get latest validation (live or history) for display and staleness
  const latestValidation = useValidationStore(state => {
    const live = state.results.get(issueNumber);
    if (live) return live;
    return state.history.find(e => e.issueNumber === issueNumber);
  });

  // Use live result if available, otherwise fall back to history
  const result = liveResult || latestValidation;
  const isFromHistory = !liveResult && !!latestValidation;

  // Confirmation dialog state
  const [showConfirm, setShowConfirm] = useState(false);

  // Push modal state
  const [showPushModal, setShowPushModal] = useState(false);
  const pushStatus = useValidationStore(state => state.pushStatus.get(issueNumber) || 'idle');
  const postedUrl = useValidationStore(state => state.postedCommentUrls.get(issueNumber));

  // Reset states when issue changes
  useEffect(() => {
    setShowConfirm(false);
  }, [issueNumber]);

  // Derive status from queue
  const queueItem = queue.find(q => q.issueNumber === issueNumber);
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

  // Step log visibility — treat "queued with steps" as actively running
  const hasSteps = steps && steps.length > 0;
  const isActivelyRunning = isRunning || (isQueued && hasSteps);
  const showCollapsibleLog = hasSteps && !isActivelyRunning;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0 mt-0.5"
            onClick={() => setSelectedIssue(null)}
            title="Back to issues"
          >
            <ArrowLeft size={16} />
          </Button>

          {/* Issue info */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-mono text-muted-foreground">#{issue.number}</span>
            <h2 className="text-lg font-semibold text-foreground leading-tight mt-0.5">
              {issue.title}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              {/* Labels */}
              {issue.labels.map(label => (
                <Badge
                  key={label.name}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                  style={
                    label.color
                      ? {
                          borderColor: `#${label.color}40`,
                          backgroundColor: `#${label.color}15`,
                          color: `#${label.color}`,
                        }
                      : undefined
                  }
                >
                  {label.name}
                </Badge>
              ))}
              {/* Comments count */}
              {issue.commentsCount > 0 && (
                <>
                  {issue.labels.length > 0 && <span className="text-muted-foreground/40">|</span>}
                  <span className="flex items-center gap-0.5">
                    <MessageSquare size={12} />
                    {issue.commentsCount} comments
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {(isIdle || canRevalidate) && (
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => {
                  if (canRevalidate && hasResult) {
                    setShowConfirm(true);
                  } else {
                    startValidation(issueNumber);
                  }
                }}
              >
                {canRevalidate ? (
                  <>
                    <RefreshCw size={14} /> Re-validate
                  </>
                ) : (
                  <>
                    <Play size={14} /> Validate
                  </>
                )}
              </Button>
            )}
            {(isRunning || isQueued) && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => cancelValidation(issueNumber)}
              >
                <X size={14} /> Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Queued status — only when no steps have arrived yet */}
        {isQueued && !hasSteps && (
          <div className="flex items-center gap-1.5 mt-2 ml-11 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />
            <span>Waiting in queue...</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Content */}
      <div data-testid="validation-content" className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Error state */}
        {(isFailed || (error && !isRunning)) && error && (
          <div className="rounded-lg border p-4 border-destructive/30 bg-destructive/5">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Validation failed</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs mt-2 text-destructive hover:text-destructive"
                  onClick={() => startValidation(issueNumber)}
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
                  onClick={() => setShowConfirm(true)}
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

        {/* Agent activity hero — shown while running or queued with steps */}
        {isActivelyRunning && <AgentActivityHero steps={steps || []} isRunning={true} />}

        {/* Collapsible activity log — shown after completion */}
        {showCollapsibleLog && <CollapsibleActivityLog steps={steps!} isRunning={false} />}

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
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setShowPushModal(true)}
                >
                  <Send size={12} /> Push to GitHub
                </Button>
              )}
            </div>
          </>
        )}

        {/* Push modal (lazy loaded) */}
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
              issueNumber={issueNumber}
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
              className="h-7 text-xs mt-1"
              onClick={() => startValidation(issueNumber)}
            >
              <RefreshCw size={12} className="mr-1" /> Run again
            </Button>
          </div>
        )}

        {/* Empty idle state */}
        {isIdle && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">No validation results yet</p>
            <p className="text-xs mt-1">
              Click <strong>Validate</strong> to analyze this issue
            </p>
          </div>
        )}
      </div>

      {/* Re-validate confirmation dialog */}
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Discard current validation?"
        description="Starting a new validation will discard all existing results for this issue. This action cannot be undone."
        confirmLabel="Discard & Re-validate"
        onConfirm={() => startValidation(issueNumber)}
      />
    </div>
  );
}
