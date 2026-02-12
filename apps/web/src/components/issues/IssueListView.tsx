import { useCallback, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIssues } from '@/hooks/useIssues';
import { useIssueStore } from '@/stores/useIssueStore';
import { IssueCard } from './IssueCard';
import { IssueFilters } from './IssueFilters';
import { EmptyIssuesState } from './EmptyIssuesState';
import { ValidationPanel } from '../validation/ValidationPanel';
import { ValidationHistory } from '../validation/ValidationHistory';

interface IssueListViewProps {
  className?: string;
}

/**
 * Loading skeleton for issue cards
 */
function IssueCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 animate-pulse">
      <div className="flex items-start gap-2">
        <div className="w-8 h-4 bg-muted rounded" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <div className="h-4 w-14 bg-muted rounded" />
        <div className="h-4 w-10 bg-muted rounded" />
        <div className="flex-1" />
        <div className="h-3 w-8 bg-muted rounded" />
      </div>
    </div>
  );
}

/**
 * Main issue listing view component.
 *
 * Displays a header with title, count badge, and refresh button,
 * followed by sort/filter controls and a scrollable list of issue cards.
 * Shows loading skeletons while fetching and an empty state when no issues exist.
 */
export function IssueListView({ className }: IssueListViewProps) {
  const { isLoading, error, refetch } = useIssues();
  const issues = useIssueStore(state => state.issues);
  const sortBy = useIssueStore(state => state.sortBy);
  const filterLabels = useIssueStore(state => state.filterLabels);
  const selectedIssueNumber = useIssueStore(state => state.selectedIssueNumber);
  const setSelectedIssue = useIssueStore(state => state.setSelectedIssue);
  const totalIssues = issues.length;

  // Memoize filtered+sorted issues to avoid creating new arrays on every render
  const filteredIssues = useMemo(() => {
    let filtered = issues;
    if (filterLabels.length > 0) {
      filtered = filtered.filter(issue =>
        filterLabels.some(filterLabel => issue.labels.some(label => label.name === filterLabel))
      );
    }
    const sorted = [...filtered];
    switch (sortBy) {
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
  }, [issues, sortBy, filterLabels]);

  const hasSelection = selectedIssueNumber !== null;

  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredIssues.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 100,
    gap: 8,
    overscan: 5,
    getItemKey: useCallback((index: number) => filteredIssues[index].number, [filteredIssues]),
  });

  return (
    <div className={cn('flex h-full', className)}>
      {/* Issue list panel */}
      <div className={cn('flex flex-col h-full', hasSelection ? 'w-1/2 border-r' : 'w-full')}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Issues</h2>
            {totalIssues > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalIssues}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => refetch()}
            disabled={isLoading}
            title="Refresh issues"
          >
            <RefreshCw size={16} className={cn(isLoading && 'animate-spin')} />
          </Button>
        </div>

        {/* Filters */}
        {totalIssues > 0 && (
          <div className="px-4 pb-3">
            <IssueFilters />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mx-4 mb-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => refetch()}
            >
              Try again
            </Button>
          </div>
        )}

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
          {isLoading && totalIssues === 0 ? (
            /* Loading skeletons */
            <div className="space-y-2">
              <IssueCardSkeleton />
              <IssueCardSkeleton />
              <IssueCardSkeleton />
              <IssueCardSkeleton />
              <IssueCardSkeleton />
            </div>
          ) : totalIssues === 0 ? (
            /* Empty state */
            <EmptyIssuesState />
          ) : filteredIssues.length === 0 ? (
            /* Filtered empty */
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">No issues match the selected filters.</p>
            </div>
          ) : (
            /* Virtualized issue cards */
            <div
              style={{
                height: virtualizer.getTotalSize(),
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map(virtualItem => {
                const issue = filteredIssues[virtualItem.index];
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <IssueCard
                      issue={issue}
                      isSelected={selectedIssueNumber === issue.number}
                      onClick={() =>
                        setSelectedIssue(selectedIssueNumber === issue.number ? null : issue.number)
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Validation history (collapsible section below issue list) */}
        <ValidationHistory />
      </div>

      {/* Validation panel (right side, shown when issue selected) */}
      {hasSelection && (
        <div className="w-1/2 h-full">
          <ValidationPanel />
        </div>
      )}
    </div>
  );
}
