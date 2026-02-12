import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PullRequest } from '@gitchorus/shared';
import { usePullRequests } from '@/hooks/usePullRequests';
import { useReviewStore } from '@/stores/useReviewStore';
import { PRCard } from './PRCard';
import { PRFilters } from './PRFilters';
import { EmptyPRsState } from './EmptyPRsState';
import { ReviewView } from './ReviewView';

interface PRListViewProps {
  className?: string;
}

/**
 * Loading skeleton for PR cards
 */
function PRCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 animate-pulse">
      <div className="flex items-start gap-2">
        <div className="w-8 h-4 bg-muted rounded" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
        </div>
        <div className="h-5 w-12 bg-muted rounded" />
      </div>
      <div className="flex items-center gap-2 mt-3">
        <div className="h-4 w-14 bg-muted rounded" />
        <div className="flex-1" />
        <div className="h-3 w-16 bg-muted rounded" />
        <div className="h-3 w-10 bg-muted rounded" />
      </div>
    </div>
  );
}

/**
 * Main pull request listing view component.
 *
 * Displays a header with title, count badge, and refresh button,
 * followed by sort/filter controls and a scrollable list of PR cards.
 * Shows loading skeletons while fetching and an empty state when no PRs exist.
 *
 * When a PR is selected (selectedPrNumber !== null), shows the full-width
 * ReviewView with streaming progress and review results.
 */
export function PRListView({ className }: PRListViewProps) {
  const { loading, error, refresh } = usePullRequests();
  const pullRequests = useReviewStore((state) => state.pullRequests);
  const sortBy = useReviewStore((state) => state.sortBy);
  const selectedPrNumber = useReviewStore((state) => state.selectedPrNumber);
  const setSelectedPr = useReviewStore((state) => state.setSelectedPr);

  // Sort in useMemo to avoid creating new array references in the selector
  // (selectSortedPRs creates a new array every call, causing infinite re-renders)
  const sortedPRs = useMemo(() => {
    const sorted = [...pullRequests];
    switch (sortBy) {
      case 'updated':
        sorted.sort((a: PullRequest, b: PullRequest) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      case 'created':
        sorted.sort((a: PullRequest, b: PullRequest) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'comments':
        sorted.sort((a: PullRequest, b: PullRequest) => b.changedFiles - a.changedFiles);
        break;
    }
    return sorted;
  }, [pullRequests, sortBy]);

  const totalPRs = sortedPRs.length;

  const hasSelection = selectedPrNumber !== null;

  const selectedPR = useMemo(() => {
    if (!hasSelection) return null;
    return sortedPRs.find((pr) => pr.number === selectedPrNumber) ?? null;
  }, [sortedPRs, selectedPrNumber, hasSelection]);

  // Full-width ReviewView when a PR is selected
  if (hasSelection && selectedPR) {
    return (
      <div className={cn('h-full', className)}>
        <ReviewView pr={selectedPR} />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Pull Requests</h2>
          {totalPRs > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalPRs}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => refresh()}
          disabled={loading}
          title="Refresh pull requests"
        >
          <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Filters */}
      <div className="px-4 pb-3">
        <PRFilters />
      </div>

      {/* Error state */}
      {error && (
        <div className="mx-4 mb-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => refresh()}
          >
            Try again
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading && totalPRs === 0 ? (
          /* Loading skeletons */
          <div className="space-y-2">
            <PRCardSkeleton />
            <PRCardSkeleton />
            <PRCardSkeleton />
            <PRCardSkeleton />
            <PRCardSkeleton />
          </div>
        ) : totalPRs === 0 ? (
          /* Empty state */
          <EmptyPRsState />
        ) : (
          /* PR cards */
          <div className="space-y-2">
            {sortedPRs.map((pr) => (
              <PRCard
                key={pr.number}
                pr={pr}
                isSelected={selectedPrNumber === pr.number}
                onClick={() =>
                  setSelectedPr(
                    selectedPrNumber === pr.number ? null : pr.number
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
