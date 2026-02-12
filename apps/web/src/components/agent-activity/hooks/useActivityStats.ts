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
export function useActivityStats(steps: ValidationStep[]): ActivityStats {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const filesRead = useMemo(() => steps.filter(s => s.toolName === 'Read').length, [steps]);

  const searchesPerformed = useMemo(
    () => steps.filter(s => s.toolName === 'Grep' || s.toolName === 'Glob').length,
    [steps]
  );

  const commandsRun = useMemo(() => steps.filter(s => s.toolName === 'Bash').length, [steps]);

  // Elapsed time ticker
  const firstTimestamp = steps[0]?.timestamp;
  useEffect(() => {
    if (!firstTimestamp) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = new Date(firstTimestamp).getTime();
    setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [firstTimestamp]);

  return {
    filesRead,
    searchesPerformed,
    commandsRun,
    elapsedSeconds,
    totalSteps: steps.length,
  };
}
