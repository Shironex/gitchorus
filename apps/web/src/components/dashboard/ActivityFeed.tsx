import { CircleDot, GitPullRequest, Search, FileSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActivityItem } from '@/hooks/useDashboard';

interface ActivityFeedProps {
  items: ActivityItem[];
  onNavigate: (type: ActivityItem['type'], number: number) => void;
}

// ============================================
// Helpers
// ============================================

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function getActivityIcon(type: ActivityItem['type']) {
  switch (type) {
    case 'validation':
      return <Search size={15} className="text-primary" />;
    case 'review':
      return <FileSearch size={15} className="text-amber-500" />;
    case 'issue-opened':
      return <CircleDot size={15} className="text-emerald-500" />;
    case 'pr-opened':
      return <GitPullRequest size={15} className="text-blue-500" />;
  }
}

function getActivityIconBg(type: ActivityItem['type']) {
  switch (type) {
    case 'validation':
      return 'bg-primary/10';
    case 'review':
      return 'bg-amber-500/10';
    case 'issue-opened':
      return 'bg-emerald-500/10';
    case 'pr-opened':
      return 'bg-blue-500/10';
  }
}

function getTypeLabel(type: ActivityItem['type']): string {
  switch (type) {
    case 'validation':
      return 'Validated';
    case 'review':
      return 'Reviewed';
    case 'issue-opened':
      return 'Opened';
    case 'pr-opened':
      return 'Opened';
  }
}

function getStatusBadge(item: ActivityItem) {
  if (item.qualityScore !== undefined) {
    return <span className="text-xs font-medium text-amber-500">{item.qualityScore}/10</span>;
  }

  if (item.verdict) {
    return (
      <span
        className={cn(
          'text-xs font-medium capitalize',
          item.verdict === 'confirmed' || item.verdict === 'likely'
            ? 'text-emerald-500'
            : item.verdict === 'uncertain'
              ? 'text-amber-500'
              : 'text-red-400'
        )}
      >
        {item.verdict}
      </span>
    );
  }

  return null;
}

// ============================================
// Component
// ============================================

/**
 * Activity feed showing recent GitChorus actions (validations, reviews)
 * and GitHub events (issue/PR opens). Items are clickable and navigate
 * to the relevant issue or PR view.
 */
export function ActivityFeed({ items, onNavigate }: ActivityFeedProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">Recent Activity</h3>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">{items.length} items</span>
        )}
      </div>

      {/* Feed */}
      {items.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">
            No recent activity. Validate an issue or review a PR to get started.
          </p>
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto -mx-2">
          {items.map(item => (
            <button
              key={item.id}
              className="w-full text-left flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
              onClick={() => onNavigate(item.type, item.number)}
            >
              {/* Icon */}
              <div
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-md shrink-0',
                  getActivityIconBg(item.type)
                )}
              >
                {getActivityIcon(item.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {getTypeLabel(item.type)} {formatRelativeTime(item.timestamp)}
                </p>
              </div>

              {/* Status badge */}
              <div className="shrink-0">{getStatusBadge(item)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
