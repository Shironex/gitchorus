import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ValidationStepLog } from '../validation/ValidationStepLog';
import type { ValidationStep } from '@gitchorus/shared';

interface CollapsibleActivityLogProps {
  steps: ValidationStep[];
  isRunning: boolean;
}

/**
 * Collapsible activity log for validation/review steps.
 * Shared by AgentActivityHero, IssueDetailView, and ReviewProgress.
 */
export function CollapsibleActivityLog({ steps, isRunning }: CollapsibleActivityLogProps) {
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>Activity Log ({steps.length} steps)</span>
      </button>
      {expanded && (
        <div className="mt-2">
          <ValidationStepLog steps={steps} isRunning={isRunning} />
        </div>
      )}
    </div>
  );
}
