import { AgentActivityHero, CollapsibleActivityLog } from '@/components/agent-activity';
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
  // While running: show the agent activity hero
  if (isRunning) {
    return <AgentActivityHero steps={steps} isRunning={true} />;
  }

  // After completion: collapsible activity log
  return <CollapsibleActivityLog steps={steps} isRunning={false} />;
}
