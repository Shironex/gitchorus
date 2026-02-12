import {
  GitPullRequestDraft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileDiff,
  Plus,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PullRequest, StatusCheckRollup } from '@gitchorus/shared';

/**
 * Format a relative time string from an ISO date
 */
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  return `${diffMonths}mo ago`;
}

/**
 * CI status indicator component
 */
function CIStatusIndicator({ status }: { status?: StatusCheckRollup }) {
  if (!status) {
    return null;
  }

  switch (status) {
    case 'SUCCESS':
      return <CheckCircle2 size={14} className="text-green-500" />;
    case 'FAILURE':
      return <XCircle size={14} className="text-red-500" />;
    case 'PENDING':
      return <Clock size={14} className="text-yellow-500 animate-pulse" />;
    case 'ERROR':
      return <AlertCircle size={14} className="text-red-500" />;
    default:
      return null;
  }
}

interface PRCardProps {
  pr: PullRequest;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * Card-based PR display with full info density:
 * title, author, age, labels, diff stats, CI status, draft badge.
 */
export function PRCard({ pr, isSelected, onClick }: PRCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-150',
        'hover:border-primary/40 hover:shadow-sm',
        isSelected && 'border-primary shadow-sm bg-primary/5'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header: number + title + badges */}
        <div className="flex items-start gap-2">
          <span className="text-xs text-muted-foreground font-mono shrink-0 mt-0.5">
            #{pr.number}
          </span>
          <h3 className="text-sm font-medium text-foreground leading-snug flex-1 min-w-0">
            {pr.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <CIStatusIndicator status={pr.statusCheckRollup} />
            {pr.isDraft && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground gap-0.5"
              >
                <GitPullRequestDraft size={10} />
                Draft
              </Badge>
            )}
          </div>
        </div>

        {/* Footer: labels + metadata */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {/* Labels */}
          {pr.labels.map(label => (
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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Diff stats */}
          {(pr.additions > 0 || pr.deletions > 0) && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                <Plus size={10} />
                {pr.additions}
              </span>
              <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
                <Minus size={10} />
                {pr.deletions}
              </span>
            </span>
          )}

          {/* Changed files */}
          {pr.changedFiles > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <FileDiff size={12} />
              {pr.changedFiles}
            </span>
          )}

          {/* Author */}
          <span className="text-xs text-muted-foreground">{pr.author.login}</span>

          {/* Age */}
          <span className="text-xs text-muted-foreground">{formatRelativeTime(pr.updatedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
