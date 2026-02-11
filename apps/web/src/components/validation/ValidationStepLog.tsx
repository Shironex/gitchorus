import { useEffect, useRef } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidationStep } from '@gitchorus/shared';

interface ValidationStepLogProps {
  steps: ValidationStep[];
  isRunning: boolean;
}

/**
 * Format a timestamp to a short time string (HH:MM:SS)
 */
function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Step-by-step log of validation progress.
 *
 * Displays a vertical list of steps with timestamps and status icons.
 * The latest step shows a spinner when the validation is running.
 * Auto-scrolls to the bottom as new steps arrive.
 */
export function ValidationStepLog({ steps, isRunning }: ValidationStepLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new steps arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps.length]);

  if (steps.length === 0) {
    return null;
  }

  return (
    <div
      ref={scrollRef}
      className="space-y-1.5 max-h-48 overflow-y-auto pr-1"
    >
      {steps.map((step, index) => {
        const isLatest = index === steps.length - 1;
        const showSpinner = isLatest && isRunning;

        return (
          <div
            key={`${step.step}-${index}`}
            className={cn(
              'flex items-start gap-2 text-xs',
              isLatest && isRunning ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {/* Status icon */}
            <div className="mt-0.5 shrink-0">
              {showSpinner ? (
                <Loader2 size={12} className="animate-spin text-primary" />
              ) : (
                <CheckCircle2 size={12} className="text-green-500" />
              )}
            </div>

            {/* Message */}
            <span className="flex-1 leading-tight">{step.message}</span>

            {/* Timestamp */}
            <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
              {formatTime(step.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
