import {
  ArrowLeft,
  Play,
  RefreshCw,
  AlertCircle,
  Loader2,
  GitBranch,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useReviewStore } from '@/stores/useReviewStore';
import { useReview } from '@/hooks/useReview';
import { ReviewProgress } from './ReviewProgress';
import type { PullRequest, ReviewResult } from '@gitchorus/shared';

interface ReviewViewProps {
  pr: PullRequest;
}

/**
 * Render severity badge with appropriate color
 */
function SeverityBadge({ severity, count }: { severity: string; count: number }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    major: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    minor: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    nit: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  };

  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium capitalize', colors[severity] || '')}>
      {severity} ({count})
    </span>
  );
}

/**
 * Placeholder display for review findings (plan 03 will build the full findings UI).
 * Shows a summary with severity breakdown and verdict.
 */
function ReviewResultSummary({ result }: { result: ReviewResult }) {
  const findingsBySeverity = result.findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const severityOrder = ['critical', 'major', 'minor', 'nit'];

  return (
    <div className="space-y-4">
      {/* Verdict and score */}
      <div className="rounded-lg border p-4 bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-foreground">Verdict</h4>
            <p className="text-sm text-muted-foreground mt-1">{result.verdict}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Star size={16} className="text-amber-500" />
            <span className="text-lg font-bold text-foreground">{result.qualityScore}</span>
            <span className="text-xs text-muted-foreground">/10</span>
          </div>
        </div>
      </div>

      {/* Severity breakdown */}
      {result.findings.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {severityOrder.map(
              (severity) =>
                findingsBySeverity[severity] && (
                  <SeverityBadge key={severity} severity={severity} count={findingsBySeverity[severity]} />
                )
            )}
          </div>

          {/* Findings list */}
          <div className="space-y-2">
            {result.findings.map((finding, index) => (
              <div
                key={index}
                className="rounded-lg border p-3 bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <SeverityBadge severity={finding.severity} count={0} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{finding.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {finding.file}:{finding.line}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{finding.explanation}</p>
                    {finding.codeSnippet && (
                      <pre className="mt-2 text-xs bg-muted/50 rounded p-2 overflow-x-auto font-mono">
                        {finding.codeSnippet}
                      </pre>
                    )}
                    {finding.suggestedFix && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Suggested fix:</p>
                        <pre className="text-xs bg-green-500/5 border border-green-500/20 rounded p-2 overflow-x-auto font-mono">
                          {finding.suggestedFix}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border p-4 bg-card text-center">
          <p className="text-sm text-muted-foreground">No issues found. Clean code!</p>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Model: {result.model}</span>
        <span>Cost: ${result.costUsd.toFixed(4)}</span>
        <span>Duration: {(result.durationMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}

/**
 * Full-width review view for a selected PR.
 *
 * Shows PR details, "Start Review" button, streaming progress,
 * and review results when complete.
 */
export function ReviewView({ pr }: ReviewViewProps) {
  const { startReview, cancelReview } = useReview();
  const setSelectedPr = useReviewStore((state) => state.setSelectedPr);

  const status = useReviewStore(
    (state) => state.reviewStatus.get(pr.number) || 'idle'
  );
  const steps = useReviewStore(
    (state) => state.reviewSteps.get(pr.number) || []
  );
  const result = useReviewStore(
    (state) => state.reviewResults.get(pr.number)
  );
  const error = useReviewStore(
    (state) => state.reviewErrors.get(pr.number)
  );

  const isRunning = status === 'running';
  const isQueued = status === 'queued';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isCancelled = status === 'cancelled';
  const hasResult = !!result;
  const isIdle = status === 'idle' && !result && !error;
  const canRestart = isCompleted || isFailed || isCancelled;

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
                onClick={() => startReview(pr.number)}
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
          </div>
        </div>
      </div>

      <Separator />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Queued indicator */}
        {isQueued && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <Loader2 size={16} className="animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Waiting in queue...</span>
          </div>
        )}

        {/* Running: show progress */}
        {isRunning && (
          <ReviewProgress
            steps={steps}
            isRunning={true}
            onCancel={() => cancelReview(pr.number)}
          />
        )}

        {/* Running with no steps yet */}
        {isRunning && steps.length === 0 && (
          <div className="flex items-center gap-2 py-8 justify-center">
            <Loader2 size={16} className="animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Starting review...</span>
          </div>
        )}

        {/* Completed: show collapsible log + results */}
        {!isRunning && steps.length > 0 && (
          <ReviewProgress
            steps={steps}
            isRunning={false}
            onCancel={() => {}}
          />
        )}

        {/* Results */}
        {hasResult && result && (
          <>
            <Separator />
            <ReviewResultSummary result={result} />
          </>
        )}

        {/* Error state */}
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

        {/* Empty idle state */}
        {isIdle && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">No review results yet</p>
            <p className="text-xs mt-1">
              Click <strong>Start Review</strong> to analyze this pull request
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
