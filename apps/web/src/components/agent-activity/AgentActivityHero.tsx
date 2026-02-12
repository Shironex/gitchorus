import { cn } from '@/lib/utils';
import type { ValidationStep, ValidationStepType } from '@gitchorus/shared';
import { useStepTransition } from './hooks/useStepTransition';
import { useActivityStats } from './hooks/useActivityStats';
import { AgentActivityStats } from './AgentActivityStats';
import { CollapsibleActivityLog } from './CollapsibleActivityLog';

import { InitIllustration } from './illustrations/InitIllustration';
import { ReadingIllustration } from './illustrations/ReadingIllustration';
import { SearchingIllustration } from './illustrations/SearchingIllustration';
import { AnalyzingIllustration } from './illustrations/AnalyzingIllustration';
import { ToolUseIllustration } from './illustrations/ToolUseIllustration';
import { ProcessingIllustration } from './illustrations/ProcessingIllustration';
import { CompleteIllustration } from './illustrations/CompleteIllustration';

interface AgentActivityHeroProps {
  steps: ValidationStep[];
  isRunning: boolean;
}

const STEP_LABELS: Record<ValidationStepType, string> = {
  init: 'Setting up',
  reading: 'Reading files',
  searching: 'Searching codebase',
  analyzing: 'Analyzing',
  'tool-use': 'Running command',
  processing: 'Processing',
  complete: 'Complete',
};

function getIllustration(type: ValidationStepType) {
  switch (type) {
    case 'init':
      return <InitIllustration />;
    case 'reading':
      return <ReadingIllustration />;
    case 'searching':
      return <SearchingIllustration />;
    case 'analyzing':
      return <AnalyzingIllustration />;
    case 'tool-use':
      return <ToolUseIllustration />;
    case 'processing':
      return <ProcessingIllustration />;
    case 'complete':
      return <CompleteIllustration />;
    default:
      return <AnalyzingIllustration />;
  }
}

/**
 * Animated hero visualization for agent activity.
 *
 * Shows a large animated SVG illustration that changes based on the current
 * action/tool being used. Includes a stats bar and collapsible activity log.
 * Replaces the plain step log during active validation/review.
 */
export function AgentActivityHero({ steps, isRunning }: AgentActivityHeroProps) {
  const { currentType, currentLabel, isTransitioning } = useStepTransition(steps);
  const stats = useActivityStats(steps);

  const actionLabel = STEP_LABELS[currentType] || 'Working';

  return (
    <div className="agent-illustration" data-testid="agent-activity-hero">
      {/* Hero illustration area */}
      <div className="flex flex-col items-center py-4">
        {/* Illustration container — fixed height to prevent layout shift */}
        <div
          className={cn(
            'relative w-full max-w-xs h-48 flex items-center justify-center',
            isTransitioning ? 'animate-hero-exit' : 'animate-hero-enter'
          )}
        >
          {getIllustration(currentType)}
        </div>

        {/* Action label */}
        <div className="mt-2 text-center" role="status" aria-live="polite">
          <p className="text-sm font-medium text-foreground">{actionLabel}</p>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-sm truncate font-mono">
            {currentLabel}
          </p>
        </div>

        {/* Stats bar */}
        {stats.totalSteps > 0 && (
          <div className="mt-4 w-full max-w-md">
            <AgentActivityStats {...stats} />
          </div>
        )}
      </div>

      {/* Collapsible activity log */}
      <CollapsibleActivityLog steps={steps} isRunning={isRunning} />
    </div>
  );
}
