import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Issue, ValidationStatus } from '@gitchorus/shared';

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
 * Map a validation status to a display badge
 */
function getValidationBadge(status: ValidationStatus): { label: string; className: string } | null {
  switch (status) {
    case 'queued':
      return { label: 'Queued', className: 'bg-muted text-muted-foreground' };
    case 'running':
      return { label: 'Running', className: 'bg-primary/20 text-primary' };
    case 'completed':
      return { label: 'Done', className: 'bg-green-500/20 text-green-700 dark:text-green-400' };
    case 'failed':
      return { label: 'Failed', className: 'bg-destructive/20 text-destructive' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-muted text-muted-foreground' };
    default:
      return null;
  }
}

interface IssueCardProps {
  issue: Issue;
  isSelected: boolean;
  onClick: () => void;
  validationStatus?: ValidationStatus;
}

/**
 * Card-based issue display with title, labels, age, and optional validation status.
 *
 * Per design decision: minimal metadata (title, labels, age only).
 * Validation status badge shown only when provided.
 */
export function IssueCard({ issue, isSelected, onClick, validationStatus }: IssueCardProps) {
  const validationBadge = validationStatus ? getValidationBadge(validationStatus) : null;

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
        {/* Header: number + title + validation badge */}
        <div className="flex items-start gap-2">
          <span className="text-xs text-muted-foreground font-mono shrink-0 mt-0.5">
            #{issue.number}
          </span>
          <h3 className="text-sm font-medium text-foreground leading-snug flex-1 min-w-0">
            {issue.title}
          </h3>
          {validationBadge && (
            <Badge
              variant="outline"
              className={cn('text-[10px] px-1.5 py-0 shrink-0', validationBadge.className)}
            >
              {validationBadge.label}
            </Badge>
          )}
        </div>

        {/* Footer: labels + metadata */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {/* Labels */}
          {issue.labels.map((label) => (
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

          {/* Comments count */}
          {issue.commentsCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <MessageSquare size={12} />
              {issue.commentsCount}
            </span>
          )}

          {/* Age */}
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(issue.createdAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
