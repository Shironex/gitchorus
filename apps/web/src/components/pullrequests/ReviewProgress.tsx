import { useState } from 'react';
import {
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ValidationStepLog } from '@/components/validation/ValidationStepLog';
import type { ValidationStep } from '@gitchorus/shared';

interface ReviewProgressProps {
  steps: ValidationStep[];
  isRunning: boolean;
  onCancel: () => void;
}

/**
 * Streaming progress log for PR review.
 *
 * Reuses the ValidationStepLog component for the step-by-step activity display.
 * Shows a cancel button while review is running.
 * Collapses into "Activity Log" after review completes.
 */
export function ReviewProgress({ steps, isRunning, onCancel }: ReviewProgressProps) {
  const [logExpanded, setLogExpanded] = useState(false);

  const hasSteps = steps.length > 0;

  // While running: show open log with cancel button
  if (isRunning) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-foreground">Review Progress</h4>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs gap-1"
            onClick={onCancel}
          >
            <X size={12} /> Cancel
          </Button>
        </div>
        {hasSteps && (
          <ValidationStepLog steps={steps} isRunning={true} />
        )}
      </div>
    );
  }

  // After completion: collapsible activity log
  if (!hasSteps) return null;

  return (
    <div>
      <button
        onClick={() => setLogExpanded(!logExpanded)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        {logExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>Activity Log ({steps.length} steps)</span>
      </button>
      {logExpanded && (
        <div className="mt-2">
          <ValidationStepLog steps={steps} isRunning={false} />
        </div>
      )}
    </div>
  );
}
