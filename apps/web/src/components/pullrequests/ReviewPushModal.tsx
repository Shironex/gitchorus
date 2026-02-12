import { useState, useMemo } from 'react';
import {
  ExternalLink,
  Send,
  Loader2,
  RefreshCw,
  AlertTriangle,
  FileCode2,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Markdown } from '@/components/ui/markdown';
import { useReview } from '@/hooks/useReview';
import type { ReviewFinding } from '@gitchorus/shared';

// ============================================
// Types
// ============================================

interface ReviewPushModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFindings: ReviewFinding[];
  verdict: string;
  qualityScore: number;
  reviewAction: 'REQUEST_CHANGES' | 'COMMENT';
  prNumber: number;
}

type PushState = 'idle' | 'pushing' | 'success' | 'error';

// ============================================
// Constants
// ============================================

const GITCHORUS_MARKER = '<!-- gitchorus-review -->';

// ============================================
// Component
// ============================================

/**
 * Preview modal showing what will be posted to GitHub as a PR review.
 *
 * Per user decision: preview-only (no editing), shows what will be posted.
 * Uses Controlled Dialog pattern (same as GithubPushPreview from 02.1-03).
 */
export function ReviewPushModal({
  open,
  onOpenChange,
  selectedFindings,
  verdict,
  qualityScore,
  reviewAction,
  prNumber,
}: ReviewPushModalProps) {
  const { pushReview } = useReview();
  const [pushState, setPushState] = useState<PushState>('idle');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [postedCount, setPostedCount] = useState(0);

  // Build the summary body that will be posted
  const summaryBody = useMemo(() => {
    const findingSummaryParts = selectedFindings.map(
      (f, i) =>
        `${i + 1}. **[${f.severity.toUpperCase()} - ${f.category}]** ${f.title} (\`${f.file}:${f.line}\`)`
    );

    return [
      GITCHORUS_MARKER,
      '## GitChorus AI Review',
      '',
      verdict,
      '',
      `**Quality Score:** ${qualityScore}/10`,
      '',
      '### Findings Summary',
      '',
      ...findingSummaryParts,
      '',
      '---',
      '*via [GitChorus](https://github.com/Shironex/gitchorus)*',
    ].join('\n');
  }, [selectedFindings, verdict, qualityScore]);

  const handlePush = async () => {
    setPushState('pushing');
    setErrorMessage(null);

    try {
      const result = await pushReview(
        prNumber,
        selectedFindings,
        verdict,
        qualityScore,
        reviewAction
      );

      setResultUrl(result.url ?? null);
      setPostedCount(result.postedComments);
      setSkippedCount(result.skippedComments);
      setPushState('success');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to push review');
      setPushState('error');
    }
  };

  const handleRetry = () => {
    setPushState('idle');
    setErrorMessage(null);
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      // Reset state when closing
      setPushState('idle');
      setResultUrl(null);
      setErrorMessage(null);
      setSkippedCount(0);
      setPostedCount(0);
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-base">Push Review to GitHub</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Preview of the PR review that will be posted to PR #{prNumber}
          </DialogDescription>
        </DialogHeader>

        {/* Success state */}
        {pushState === 'success' ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-6">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <Send size={18} className="text-green-500" />
            </div>
            <p className="text-sm font-medium text-foreground">Review posted successfully</p>
            <div className="text-xs text-muted-foreground text-center space-y-1">
              <p>
                {postedCount} inline comment{postedCount !== 1 ? 's' : ''} posted
              </p>
              {skippedCount > 0 && (
                <p className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle size={12} />
                  {skippedCount} comment{skippedCount !== 1 ? 's' : ''} could not be placed inline
                  and were included in the summary
                </p>
              )}
            </div>
            {resultUrl && (
              <a
                href={resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View on GitHub <ExternalLink size={10} />
              </a>
            )}
          </div>
        ) : (
          <>
            {/* Preview content */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
              {/* Review action indicator */}
              <div className="flex items-center gap-3 text-xs">
                <span
                  className={cn(
                    'px-2 py-1 rounded border font-medium',
                    reviewAction === 'REQUEST_CHANGES'
                      ? 'border-orange-500/30 text-orange-600 dark:text-orange-400 bg-orange-500/5'
                      : 'border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/5'
                  )}
                >
                  Review action:{' '}
                  {reviewAction === 'REQUEST_CHANGES' ? 'Request Changes' : 'Comment'}
                </span>
                <span className="text-muted-foreground">
                  Posting {selectedFindings.length} inline comment
                  {selectedFindings.length !== 1 ? 's' : ''} + 1 summary review
                </span>
              </div>

              {/* Summary body preview */}
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <MessageSquare size={12} />
                  Review Summary
                </h4>
                <div className="rounded-lg border bg-white dark:bg-[#0d1117] p-4">
                  <Markdown size="sm">{summaryBody}</Markdown>
                </div>
              </div>

              {/* Inline comments preview */}
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <FileCode2 size={12} />
                  Inline Comments ({selectedFindings.length})
                </h4>
                <div className="space-y-2">
                  {selectedFindings.map((finding, idx) => (
                    <div key={idx} className="rounded-lg border p-3 bg-card">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {finding.file}:{finding.line}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wide',
                            finding.severity === 'critical' &&
                              'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
                            finding.severity === 'major' &&
                              'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
                            finding.severity === 'minor' &&
                              'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
                            finding.severity === 'nit' &&
                              'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
                          )}
                        >
                          {finding.severity}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-foreground">{finding.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {finding.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Error state */}
            {pushState === 'error' && errorMessage && (
              <div className="px-6 pb-3">
                <div className="rounded-lg border p-3 border-destructive/30 bg-destructive/5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-destructive mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-destructive">Push failed</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{errorMessage}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <DialogFooter className="px-6 py-4 border-t">
              <div className="flex items-center justify-end w-full gap-2">
                {pushState === 'error' ? (
                  <Button size="sm" className="h-8 text-xs" onClick={handleRetry}>
                    <RefreshCw size={12} className="mr-1.5" /> Retry
                  </Button>
                ) : pushState === 'pushing' ? (
                  <Button size="sm" disabled className="h-8 text-xs">
                    <Loader2 size={12} className="mr-1.5 animate-spin" /> Pushing...
                  </Button>
                ) : (
                  <Button size="sm" className="h-8 text-xs" onClick={handlePush}>
                    <Send size={12} className="mr-1.5" /> Push to GitHub
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
