import { useState } from 'react';
import {
  History,
  ChevronDown,
  ChevronRight,
  Trash2,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  XCircle,
  Bug,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useValidationStore } from '@/stores/useValidationStore';
import { useValidation } from '@/hooks/useValidation';
import { useIssueStore } from '@/stores/useIssueStore';
import type { ValidationHistoryEntry, ValidationVerdict } from '@gitchorus/shared';

/**
 * Format an ISO timestamp to a localized relative or short datetime string.
 */
function formatTimestamp(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get verdict display config
 */
function getVerdictDisplay(verdict: ValidationVerdict): {
  icon: typeof CheckCircle2;
  className: string;
  label: string;
} {
  switch (verdict) {
    case 'confirmed':
      return {
        icon: CheckCircle2,
        className: 'text-green-600 dark:text-green-400',
        label: 'Confirmed',
      };
    case 'likely':
      return { icon: CheckCircle2, className: 'text-blue-600 dark:text-blue-400', label: 'Likely' };
    case 'uncertain':
      return {
        icon: HelpCircle,
        className: 'text-yellow-600 dark:text-yellow-400',
        label: 'Uncertain',
      };
    case 'unlikely':
      return {
        icon: AlertTriangle,
        className: 'text-orange-600 dark:text-orange-400',
        label: 'Unlikely',
      };
    case 'invalid':
      return { icon: XCircle, className: 'text-red-600 dark:text-red-400', label: 'Invalid' };
  }
}

interface HistoryEntryRowProps {
  entry: ValidationHistoryEntry;
  onSelect: (issueNumber: number) => void;
  onDelete: (id: string) => void;
}

/**
 * A single row in the history list.
 */
function HistoryEntryRow({ entry, onSelect, onDelete }: HistoryEntryRowProps) {
  const verdictDisplay = getVerdictDisplay(entry.verdict);
  const VerdictIcon = verdictDisplay.icon;
  const IssueTypeIcon = entry.issueType === 'bug' ? Bug : Lightbulb;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors',
        'hover:bg-muted/50 group'
      )}
      onClick={() => onSelect(entry.issueNumber)}
    >
      {/* Verdict icon */}
      <VerdictIcon size={14} className={cn('shrink-0', verdictDisplay.className)} />

      {/* Issue info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-mono">#{entry.issueNumber}</span>
          <span className="text-xs font-medium text-foreground truncate">{entry.issueTitle}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {/* Issue type badge */}
          <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
            <IssueTypeIcon size={10} />
            {entry.issueType === 'bug' ? 'Bug' : 'Feature'}
          </Badge>

          {/* Confidence */}
          <span className="text-[10px] text-muted-foreground">{entry.confidence}%</span>

          {/* Timestamp */}
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Clock size={10} />
            {formatTimestamp(entry.validatedAt)}
          </span>
        </div>
      </div>

      {/* Verdict badge */}
      <Badge
        variant="outline"
        className={cn('text-[10px] px-1.5 py-0 shrink-0', verdictDisplay.className)}
      >
        {verdictDisplay.label}
      </Badge>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={e => {
          e.stopPropagation();
          onDelete(entry.id);
        }}
        title="Delete from history"
      >
        <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}

/**
 * Collapsible validation history section.
 *
 * Shows past validation results stored via electron-store.
 * Each entry displays issue title, verdict badge, confidence, issue type, and timestamp.
 * Clicking an entry selects the issue; delete button removes from history.
 */
export function ValidationHistory() {
  const [isExpanded, setIsExpanded] = useState(false);
  const history = useValidationStore(state => state.history);
  const historyLoading = useValidationStore(state => state.historyLoading);
  const { deleteHistoryEntry } = useValidation();
  const setSelectedIssue = useIssueStore(s => s.setSelectedIssue);

  const handleSelect = (issueNumber: number) => {
    setSelectedIssue(issueNumber);
  };

  const handleDelete = (id: string) => {
    deleteHistoryEntry(id);
  };

  if (history.length === 0 && !historyLoading) {
    return null;
  }

  return (
    <div className="border-t">
      {/* Collapsible header */}
      <button
        className={cn(
          'flex items-center gap-2 w-full px-4 py-2.5',
          'text-sm font-medium text-foreground hover:bg-muted/50 transition-colors'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <History size={14} className="text-muted-foreground" />
        <span>Validation History</span>
        {history.length > 0 && (
          <Badge variant="secondary" className="text-[10px] ml-1">
            {history.length}
          </Badge>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-2 pb-3">
          {historyLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
              <span className="ml-2 text-xs text-muted-foreground">Loading history...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground">No validation history yet</p>
            </div>
          ) : (
            <div className="space-y-0.5 max-h-64 overflow-y-auto">
              {history.map(entry => (
                <HistoryEntryRow
                  key={entry.id}
                  entry={entry}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
