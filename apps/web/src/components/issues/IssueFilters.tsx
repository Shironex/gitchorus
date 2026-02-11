import { Filter, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useIssueStore,
  selectSortBy,
  selectFilterLabels,
  selectAvailableLabels,
  type IssueSortBy,
} from '@/stores/useIssueStore';

const SORT_OPTIONS: { value: IssueSortBy; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'most-commented', label: 'Most Commented' },
];

/**
 * Sort toggle buttons and label filter dropdown.
 * Compact layout above the issue cards.
 */
export function IssueFilters() {
  const sortBy = useIssueStore(selectSortBy);
  const filterLabels = useIssueStore(selectFilterLabels);
  const availableLabels = useIssueStore(selectAvailableLabels);
  const setSortBy = useIssueStore((state) => state.setSortBy);
  const toggleLabelFilter = useIssueStore((state) => state.toggleLabelFilter);

  return (
    <div className="flex items-center gap-2">
      {/* Sort toggle group */}
      <div className="flex items-center rounded-lg border border-border/60 overflow-hidden">
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              'hover:bg-muted/80',
              sortBy === option.value
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground'
            )}
            onClick={() => setSortBy(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Label filter */}
      {availableLabels.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-[30px] gap-1.5 text-xs">
              <Filter size={14} />
              Labels
              {filterLabels.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">
                  {filterLabels.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1">
              {availableLabels.map((label) => {
                const isActive = filterLabels.includes(label.name);
                return (
                  <button
                    key={label.name}
                    className={cn(
                      'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs',
                      'hover:bg-muted/80 transition-colors',
                      isActive && 'bg-muted'
                    )}
                    onClick={() => toggleLabelFilter(label.name)}
                  >
                    <div
                      className={cn(
                        'w-3.5 h-3.5 rounded-sm border flex items-center justify-center',
                        isActive
                          ? 'bg-primary border-primary'
                          : 'border-border'
                      )}
                    >
                      {isActive && <Check size={10} className="text-primary-foreground" />}
                    </div>
                    {label.color && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: `#${label.color}` }}
                      />
                    )}
                    <span className="truncate">{label.name}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
