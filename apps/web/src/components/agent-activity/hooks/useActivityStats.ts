import { useMemo, useState, useEffect } from 'react';
import type { ValidationStep } from '@gitchorus/shared';

export interface ActivityStats {
  filesRead: number;
  searchesPerformed: number;
  commandsRun: number;
  elapsedSeconds: number;
  totalSteps: number;
}

/**
 * Derives real-time stats from the validation/review step list.
 * Counts tool invocations by type and tracks elapsed time with a 1s ticker.
 */
export function useActivityStats(steps: ValidationStep[], isRunning: boolean): ActivityStats {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { filesRead, searchesPerformed, commandsRun } = useMemo(() => {
    let files = 0,
      searches = 0,
      commands = 0;
    for (const s of steps) {
      if (s.toolName === 'Read') files++;
      else if (s.toolName === 'Grep' || s.toolName === 'Glob') searches++;
      else if (s.toolName === 'Bash') commands++;
    }
    return { filesRead: files, searchesPerformed: searches, commandsRun: commands };
  }, [steps]);

  // Elapsed time ticker — only ticks while running
  const firstTimestamp = steps[0]?.timestamp;
  useEffect(() => {
    if (!firstTimestamp) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = new Date(firstTimestamp).getTime();
    setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));

    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [firstTimestamp, isRunning]);

  return {
    filesRead,
    searchesPerformed,
    commandsRun,
    elapsedSeconds,
    totalSteps: steps.length,
  };
}
