import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ValidationStepLog } from '@/components/validation/ValidationStepLog';
import { AgentActivityHero } from '@/components/agent-activity';
import type { ValidationStep } from '@gitchorus/shared';

interface ReviewProgressProps {
  steps: ValidationStep[];
  isRunning: boolean;
}

/**
 * Streaming progress display for PR review.
 *
 * While running: shows the AgentActivityHero with animated illustrations.
 * After completion: shows a collapsible activity log.
 */
export function ReviewProgress({ steps, isRunning }: ReviewProgressProps) {
  const [logExpanded, setLogExpanded] = useState(false);

  const hasSteps = steps.length > 0;

  // While running: show the agent activity hero
  if (isRunning) {
    return <AgentActivityHero steps={steps} isRunning={true} />;
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
