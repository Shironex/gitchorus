import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Play,
  X,
  RefreshCw,
  AlertCircle,
  Loader2,
  GitBranch,
  GitCommitHorizontal,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useReviewStore } from '@/stores/useReviewStore';
import { useRepositoryStore } from '@/stores/useRepositoryStore';
import { useReview } from '@/hooks/useReview';
import { ReviewProgress } from './ReviewProgress';
import { ReviewSummary } from './ReviewSummary';
import { ReviewFindings } from './ReviewFindings';
import { ReviewPushModal } from './ReviewPushModal';
import type {
  PullRequest,
  ReviewFinding,
  ReviewHistoryEntry,
  ReviewResult,
  ValidationStep,
} from '@gitchorus/shared';

// Stable empty array reference to avoid infinite re-renders from Zustand selector
const EMPTY_STEPS: ValidationStep[] = [];

/** Check whether a review result was imported from GitHub rather than run locally. */
const isImportedReview = (r: ReviewResult) => r.isImported === true;

interface ReviewViewProps {
  pr: PullRequest;
}

type ReviewAction = 'REQUEST_CHANGES' | 'COMMENT';

/**
 * Full-width review view for a selected PR.
 *
 * Shows PR details, "Start Review" button, streaming progress,
 * and review results when complete.
 */
export function ReviewView({ pr }: ReviewViewProps) {
  const { startReview, startReReview, cancelReview, importGithubReview } = useReview();
  const setSelectedPr = useReviewStore(state => state.setSelectedPr);

  // Confirmation dialog state
  const [showConfirm, setShowConfirm] = useState(false);

  // Push modal state
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [pushFindings, setPushFindings] = useState<ReviewFinding[]>([]);
  const [pushAction, setPushAction] = useState<ReviewAction>('COMMENT');

  // GitHub import state
  const [importChecking, setImportChecking] = useState(false);
  const importCheckedRef = useRef<number | null>(null);

  const status = useReviewStore(state => state.reviewStatus.get(pr.number) || 'idle');
  const steps = useReviewStore(state => state.reviewSteps.get(pr.number) ?? EMPTY_STEPS);
  const result = useReviewStore(state => state.reviewResults.get(pr.number));
  const error = useReviewStore(state => state.reviewErrors.get(pr.number));

  const isRunning = status === 'running';
  const isQueued = status === 'queued';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isCancelled = status === 'cancelled';
  const hasResult = !!result;
  const isIdle = status === 'idle' && !result && !error;
  const canRestart = isCompleted || isFailed || isCancelled;

  // Find the latest history entry for this PR (used for re-review chaining)
  const repositoryFullName = useRepositoryStore(state => state.githubInfo?.fullName);
  const historyLoading = useReviewStore(state => state.historyLoading);
  const latestHistoryEntry = useReviewStore(state =>
    state.reviewHistory.find(
      e => e.prNumber === pr.number && e.repositoryFullName === repositoryFullName
    )
  ) as ReviewHistoryEntry | undefined;

  // Auto-check GitHub for existing GitChorus reviews when no local history exists
  useEffect(() => {
    if (
      !repositoryFullName ||
      historyLoading ||
      latestHistoryEntry ||
      hasResult ||
      !isIdle ||
      importCheckedRef.current === pr.number
    ) {
      return;
    }

    let cancelled = false;
    importCheckedRef.current = pr.number;
    setImportChecking(true);
    importGithubReview(pr.number, repositoryFullName).finally(() => {
      if (!cancelled) {
        setImportChecking(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    pr.number,
    repositoryFullName,
    historyLoading,
    latestHistoryEntry,
    hasResult,
    isIdle,
    importGithubReview,
  ]);

  /** Start a re-review with chain context, or a fresh review if no history */
  const handleReReview = () => {
    if (latestHistoryEntry?.id) {
      startReReview(pr.number, latestHistoryEntry.id);
    } else {
      startReview(pr.number);
    }
  };

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
            onClick={() => setSelectedPr(null)}
            title="Back to PR list"
          >
            <ArrowLeft size={16} />
          </Button>

          {/* PR info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-muted-foreground">#{pr.number}</span>
              {pr.isDraft && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                  Draft
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-foreground leading-tight mt-0.5">
              {pr.title}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{pr.author.login}</span>
              <span className="text-muted-foreground/40">|</span>
              <div className="flex items-center gap-1">
                <GitBranch size={12} />
                <span className="font-mono">{pr.headRefName}</span>
                <span>-&gt;</span>
                <span className="font-mono">{pr.baseRefName}</span>
              </div>
              <span className="text-muted-foreground/40">|</span>
              <span className="text-green-600 dark:text-green-400">+{pr.additions}</span>
              <span className="text-red-600 dark:text-red-400">-{pr.deletions}</span>
              <span>{pr.changedFiles} files</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {(isIdle || canRestart) && (
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => {
                  if (canRestart && hasResult) {
                    if (latestHistoryEntry?.id) {
                      // Re-review with chain context — no need to confirm discard
                      handleReReview();
                    } else {
                      // No history to chain from — confirm fresh review
                      setShowConfirm(true);
                    }
                  } else {
                    startReview(pr.number);
                  }
                }}
              >
                {canRestart ? (
                  <>
                    <RefreshCw size={14} /> Re-review
                  </>
                ) : (
                  <>
                    <Play size={14} /> Start Review
                  </>
                )}
              </Button>
            )}
            {(isRunning || isQueued) && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => cancelReview(pr.number)}
              >
                <X size={14} /> Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Content */}
      <div data-testid="review-content" className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Imported from GitHub indicator */}
        {hasResult && result && isImportedReview(result) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5 text-xs text-muted-foreground">
            <Download size={14} className="text-blue-500" />
            <span>
              Previous review imported from GitHub — score: {result.qualityScore}/10. You can
              re-review to get full findings.
            </span>
          </div>
        )}

        {/* Re-review sequence indicator */}
        {result?.isReReview && result.reviewSequence && result.reviewSequence > 1 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
            <GitCommitHorizontal size={14} />
            <span>
              Review #{result.reviewSequence} of PR #{pr.number}
              {result.previousScore != null && <> — Previous score: {result.previousScore}/10</>}
            </span>
          </div>
        )}

        {/* Error state — shown at top for immediate visibility */}
        {(isFailed || (error && !isRunning)) && error && (
          <div className="rounded-lg border p-4 border-destructive/30 bg-destructive/5">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Review failed</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs mt-2 text-destructive hover:text-destructive"
                  onClick={() => startReview(pr.number)}
                >
                  <RefreshCw size={12} className="mr-1" /> Retry
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Queued indicator — only when no steps have arrived yet */}
        {isQueued && steps.length === 0 && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <Loader2 size={16} className="animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Waiting in queue...</span>
          </div>
        )}

        {/* Running (or queued with steps): show agent activity hero */}
        {(isRunning || (isQueued && steps.length > 0)) && (
          <ReviewProgress steps={steps} isRunning={true} />
        )}

        {/* Completed: show collapsible log + results */}
        {!isRunning && !isQueued && steps.length > 0 && (
          <ReviewProgress steps={steps} isRunning={false} />
        )}

        {/* Results */}
        {hasResult && result && (
          <>
            <Separator />
            <ReviewSummary result={result} />
            <ReviewFindings
              result={result}
              onPushToGithub={(findings, action) => {
                setPushFindings(findings);
                setPushAction(action);
                setPushModalOpen(true);
              }}
            />
          </>
        )}

        {/* Cancelled state */}
        {isCancelled && !error && (
          <div className="rounded-lg border p-3 border-muted bg-muted/30">
            <p className="text-xs text-muted-foreground">Review was cancelled.</p>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs mt-1"
              onClick={() => startReview(pr.number)}
            >
              <RefreshCw size={12} className="mr-1" /> Run again
            </Button>
          </div>
        )}

        {/* Checking GitHub for existing reviews */}
        {importChecking && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <Download size={14} className="text-muted-foreground animate-pulse" />
            <span className="text-sm text-muted-foreground">
              Checking GitHub for existing reviews...
            </span>
          </div>
        )}

        {/* Empty idle state */}
        {isIdle && !error && !importChecking && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">No review results yet</p>
            <p className="text-xs mt-1">
              Click <strong>Start Review</strong> to analyze this pull request
            </p>
          </div>
        )}
      </div>

      {/* Push to GitHub modal */}
      {result && (
        <ReviewPushModal
          open={pushModalOpen}
          onOpenChange={setPushModalOpen}
          selectedFindings={pushFindings}
          verdict={result.verdict}
          qualityScore={result.qualityScore}
          reviewAction={pushAction}
          prNumber={pr.number}
        />
      )}

      {/* Re-review confirmation dialog */}
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Discard current review?"
        description="Starting a new review will discard all existing results for this pull request. This action cannot be undone."
        confirmLabel="Discard & Re-review"
        onConfirm={() => startReview(pr.number)}
      />
    </div>
  );
}
