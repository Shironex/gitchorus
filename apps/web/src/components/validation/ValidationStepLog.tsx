import { useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, FileText, Search, Terminal, Cpu, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidationStep, ValidationStepType } from '@gitchorus/shared';

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
 * Get the appropriate icon for a step type.
 * Returns a styled icon element with color coding per activity type.
 */
function getStepIcon(
  stepType: ValidationStepType | undefined,
  toolName: string | undefined,
  isLatest: boolean,
  isRunning: boolean
): React.ReactElement {
  // Latest running step always shows spinner
  if (isLatest && isRunning) {
    return <Loader2 size={12} className="animate-spin text-primary" />;
  }

  // Use toolName as secondary signal for icon selection
  if (toolName === 'Bash' || stepType === 'tool-use') {
    return <Terminal size={12} className="text-green-500" />;
  }

  switch (stepType) {
    case 'reading':
      return <FileText size={12} className="text-blue-500" />;
    case 'searching':
      return <Search size={12} className="text-amber-500" />;
    case 'analyzing':
      return <Cpu size={12} className="text-purple-500" />;
    case 'init':
      return <Settings size={12} className="text-muted-foreground" />;
    case 'processing':
      return <Loader2 size={12} className="text-teal-500" />;
    case 'complete':
      return <CheckCircle2 size={12} className="text-green-500" />;
    default:
      return <CheckCircle2 size={12} className="text-green-500" />;
  }
}

/**
 * Render a message, highlighting file paths in monospace primary color.
 */
function renderMessage(message: string, filePath?: string): React.ReactNode {
  if (!filePath || !message.includes(filePath)) {
    return message;
  }

  const idx = message.indexOf(filePath);
  const before = message.slice(0, idx);
  const after = message.slice(idx + filePath.length);

  return (
    <>
      {before}
      <span className="font-mono text-primary">{filePath}</span>
      {after}
    </>
  );
}

/**
 * Step-by-step log of validation progress.
 *
 * Displays a terminal-style vertical list of steps with timestamps and
 * step-type-specific icons. File paths are highlighted in monospace.
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
      className="bg-muted/30 rounded-lg p-2 space-y-1.5 max-h-48 overflow-y-auto"
    >
      {steps.map((step, index) => {
        const isLatest = index === steps.length - 1;

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
              {getStepIcon(step.stepType, step.toolName, isLatest, isRunning)}
            </div>

            {/* Message */}
            <span className="flex-1 leading-tight">
              {renderMessage(step.message, step.filePath)}
            </span>

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
