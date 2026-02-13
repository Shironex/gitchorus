import { useState, useMemo, useCallback } from 'react';
import { Send, ChevronDown, CheckCircle2, AlertTriangle, XCircle, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FindingCard } from './FindingCard';
import type {
  ReviewFinding,
  ReviewResult,
  ReviewSeverity,
  AddressedFindingSummary,
} from '@gitchorus/shared';

// ============================================
// Types
// ============================================

type ReviewAction = 'REQUEST_CHANGES' | 'COMMENT';

interface ReviewFindingsProps {
  result: ReviewResult;
  onPushToGithub: (selectedFindings: ReviewFinding[], reviewAction: ReviewAction) => void;
}

// ============================================
// Constants
// ============================================

const SEVERITY_ORDER: ReviewSeverity[] = ['critical', 'major', 'minor', 'nit'];

const severityHeaderColors: Record<ReviewSeverity, string> = {
  critical: 'text-red-600 dark:text-red-400',
  major: 'text-orange-600 dark:text-orange-400',
  minor: 'text-yellow-600 dark:text-yellow-400',
  nit: 'text-gray-600 dark:text-gray-400',
};

const severityCountBg: Record<ReviewSeverity, string> = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400',
  major: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  minor: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  nit: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

// ============================================
// Addressed Findings (Re-review)
// ============================================

const addressedStatusConfig = {
  addressed: {
    icon: CheckCircle2,
    label: 'Addressed',
    colorClass: 'text-green-600 dark:text-green-400',
    bgClass: 'bg-green-500/10',
  },
  'partially-addressed': {
    icon: AlertTriangle,
    label: 'Partial',
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-500/10',
  },
  unaddressed: {
    icon: XCircle,
    label: 'Unaddressed',
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-500/10',
  },
  'new-issue': {
    icon: CircleDot,
    label: 'New Issue',
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-500/10',
  },
} as const;

function AddressedFindingsSection({ findings }: { findings: AddressedFindingSummary[] }) {
  const grouped = useMemo(() => {
    const groups: Record<string, AddressedFindingSummary[]> = {
      addressed: [],
      'partially-addressed': [],
      unaddressed: [],
      'new-issue': [],
    };
    for (const f of findings) {
      groups[f.status]?.push(f);
    }
    return groups;
  }, [findings]);

  const addressedCount = grouped['addressed'].length;
  const totalPrevious = findings.filter(f => f.status !== 'new-issue').length;

  return (
    <div className="rounded-lg border p-4 bg-card space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Previous Findings Status</h4>
        <span className="text-xs text-muted-foreground">
          {addressedCount}/{totalPrevious} addressed
        </span>
      </div>

      <div className="space-y-2">
        {findings.map((finding, i) => {
          const config = addressedStatusConfig[finding.status];
          const Icon = config.icon;
          return (
            <div
              key={i}
              className={cn('flex items-start gap-2 px-3 py-2 rounded-md text-xs', config.bgClass)}
            >
              <Icon size={14} className={cn('shrink-0 mt-0.5', config.colorClass)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('font-medium', config.colorClass)}>{config.label}</span>
                  <span className="text-muted-foreground capitalize">({finding.severity})</span>
                </div>
                <p className="text-foreground font-medium mt-0.5">{finding.title}</p>
                <p className="text-muted-foreground mt-0.5">{finding.explanation}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Component
// ============================================

/**
 * Findings display grouped by severity with selection controls.
 *
 * Features:
 * - Severity group headers with count badges
 * - Severity-level toggle checkboxes for bulk selection
 * - Per-finding checkboxes for fine-tuning
 * - Auto-determined review action (REQUEST_CHANGES if Critical selected)
 * - User can override review action via dropdown
 * - "Push to GitHub" button at the top
 */
export function ReviewFindings({ result, onPushToGithub }: ReviewFindingsProps) {
  // All findings selected by default
  const allIndices = useMemo(() => new Set(result.findings.map((_, i) => i)), [result.findings]);
  const [selectedFindings, setSelectedFindings] = useState<Set<number>>(allIndices);
  const [actionOverride, setActionOverride] = useState<ReviewAction | null>(null);
  const [showActionDropdown, setShowActionDropdown] = useState(false);

  // Group findings by severity
  const groupedFindings = useMemo(() => {
    const groups = new Map<ReviewSeverity, { finding: ReviewFinding; index: number }[]>();
    for (const severity of SEVERITY_ORDER) {
      groups.set(severity, []);
    }
    result.findings.forEach((finding, index) => {
      const group = groups.get(finding.severity);
      if (group) {
        group.push({ finding, index });
      }
    });
    return groups;
  }, [result.findings]);

  // Auto-determine review action based on selected findings
  const autoAction: ReviewAction = useMemo(() => {
    for (const idx of selectedFindings) {
      if (result.findings[idx]?.severity === 'critical') {
        return 'REQUEST_CHANGES';
      }
    }
    return 'COMMENT';
  }, [selectedFindings, result.findings]);

  const reviewAction = actionOverride ?? autoAction;
  const selectedCount = selectedFindings.size;
  const hasSelection = selectedCount > 0;

  // Get selected finding objects
  const getSelectedFindings = useCallback((): ReviewFinding[] => {
    return result.findings.filter((_, i) => selectedFindings.has(i));
  }, [result.findings, selectedFindings]);

  // Toggle individual finding
  const toggleFinding = useCallback((index: number) => {
    setSelectedFindings(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Toggle all findings in a severity group
  const toggleSeverityGroup = useCallback(
    (severity: ReviewSeverity) => {
      const group = groupedFindings.get(severity);
      if (!group || group.length === 0) return;

      setSelectedFindings(prev => {
        const next = new Set(prev);
        const allSelected = group.every(({ index }) => next.has(index));

        if (allSelected) {
          // Deselect all in group
          for (const { index } of group) {
            next.delete(index);
          }
        } else {
          // Select all in group
          for (const { index } of group) {
            next.add(index);
          }
        }
        return next;
      });
    },
    [groupedFindings]
  );

  // Check if all findings in a severity group are selected
  const isSeverityGroupSelected = useCallback(
    (severity: ReviewSeverity): boolean => {
      const group = groupedFindings.get(severity);
      if (!group || group.length === 0) return false;
      return group.every(({ index }) => selectedFindings.has(index));
    },
    [groupedFindings, selectedFindings]
  );

  // Check if some (but not all) findings in a severity group are selected
  const isSeverityGroupIndeterminate = useCallback(
    (severity: ReviewSeverity): boolean => {
      const group = groupedFindings.get(severity);
      if (!group || group.length === 0) return false;
      const selectedInGroup = group.filter(({ index }) => selectedFindings.has(index));
      return selectedInGroup.length > 0 && selectedInGroup.length < group.length;
    },
    [groupedFindings, selectedFindings]
  );

  if (result.findings.length === 0 && !result.addressedFindings?.length) {
    return (
      <div className="rounded-lg border p-6 bg-card text-center">
        <p className="text-sm text-muted-foreground">No findings. Clean code!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Addressed findings from previous review (re-review only) */}
      {result.addressedFindings && result.addressedFindings.length > 0 && (
        <AddressedFindingsSection findings={result.addressedFindings} />
      )}

      {/* Top bar: selection info + push button */}
      <div className="flex items-center justify-between gap-3 sticky top-0 z-10 bg-background py-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {selectedCount} of {result.findings.length} findings selected
          </span>
          {/* Review action indicator */}
          <div className="relative">
            <button
              onClick={() => setShowActionDropdown(p => !p)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium transition-colors',
                reviewAction === 'REQUEST_CHANGES'
                  ? 'border-orange-500/30 text-orange-600 dark:text-orange-400 bg-orange-500/5'
                  : 'border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/5'
              )}
            >
              {reviewAction === 'REQUEST_CHANGES' ? 'Request Changes' : 'Comment'}
              <ChevronDown size={12} />
            </button>
            {showActionDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-popover border rounded-md shadow-md z-20 min-w-[160px]">
                <button
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors',
                    reviewAction === 'REQUEST_CHANGES' && 'font-medium text-foreground'
                  )}
                  onClick={() => {
                    setActionOverride('REQUEST_CHANGES');
                    setShowActionDropdown(false);
                  }}
                >
                  Request Changes
                </button>
                <button
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors',
                    reviewAction === 'COMMENT' && 'font-medium text-foreground'
                  )}
                  onClick={() => {
                    setActionOverride('COMMENT');
                    setShowActionDropdown(false);
                  }}
                >
                  Comment
                </button>
              </div>
            )}
          </div>
        </div>

        <Button
          size="sm"
          className="h-8 gap-1.5"
          disabled={!hasSelection}
          onClick={() => onPushToGithub(getSelectedFindings(), reviewAction)}
        >
          <Send size={14} />
          Push to GitHub
        </Button>
      </div>

      {/* Severity groups */}
      {SEVERITY_ORDER.map(severity => {
        const group = groupedFindings.get(severity);
        if (!group || group.length === 0) return null;

        const allSelected = isSeverityGroupSelected(severity);
        const indeterminate = isSeverityGroupIndeterminate(severity);

        return (
          <div key={severity} className="space-y-2">
            {/* Severity group header */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => {
                    if (el) el.indeterminate = indeterminate;
                  }}
                  onChange={() => toggleSeverityGroup(severity)}
                  className="h-4 w-4 rounded border-input text-primary accent-primary focus:ring-primary"
                />
                <span
                  className={cn('text-sm font-semibold capitalize', severityHeaderColors[severity])}
                >
                  {severity}
                </span>
              </label>
              <span
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  severityCountBg[severity]
                )}
              >
                {group.length}
              </span>
            </div>

            {/* Finding cards */}
            <div className="space-y-2 pl-1">
              {group.map(({ finding, index }) => (
                <FindingCard
                  key={index}
                  finding={finding}
                  index={index}
                  selected={selectedFindings.has(index)}
                  onToggle={toggleFinding}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
