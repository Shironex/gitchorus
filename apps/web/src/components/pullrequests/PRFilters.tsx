import { cn } from '@/lib/utils';
import {
  useReviewStore,
  selectPRSortBy,
  selectPRFilterState,
  type PRSortBy,
} from '@/stores/useReviewStore';

const SORT_OPTIONS: { value: PRSortBy; label: string }[] = [
  { value: 'updated', label: 'Recently Updated' },
  { value: 'created', label: 'Newest' },
  { value: 'comments', label: 'Most Changed' },
];

const STATE_OPTIONS: { value: 'open' | 'closed' | 'all'; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];

/**
 * Sort toggle buttons and state filter for pull requests.
 * Compact layout above the PR cards.
 */
export function PRFilters() {
  const sortBy = useReviewStore(selectPRSortBy);
  const filterState = useReviewStore(selectPRFilterState);
  const setSortBy = useReviewStore(state => state.setSortBy);
  const setFilterState = useReviewStore(state => state.setFilterState);

  return (
    <div className="flex items-center gap-2">
      {/* Sort toggle group */}
      <div className="flex items-center rounded-lg border border-border/60 overflow-hidden">
        {SORT_OPTIONS.map(option => (
          <button
            key={option.value}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              'hover:bg-muted/80',
              sortBy === option.value ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
            )}
            onClick={() => setSortBy(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* State filter toggle group */}
      <div className="flex items-center rounded-lg border border-border/60 overflow-hidden">
        {STATE_OPTIONS.map(option => (
          <button
            key={option.value}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              'hover:bg-muted/80',
              filterState === option.value ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
            )}
            onClick={() => setFilterState(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
