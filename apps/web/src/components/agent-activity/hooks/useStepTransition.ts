import { useState, useEffect, useRef } from 'react';
import type { ValidationStep, ValidationStepType } from '@gitchorus/shared';

export interface StepTransitionState {
  /** The currently displayed step type */
  currentType: ValidationStepType;
  /** The label to show (file path, message, etc.) */
  currentLabel: string;
  /** Whether we are mid-transition (used for exit animation) */
  isTransitioning: boolean;
}

function deriveLabel(step?: ValidationStep): string {
  if (!step) return 'Initializing...';
  if (step.filePath) return step.filePath;
  return step.message;
}

/**
 * Manages smooth transitions between step types.
 * Debounces rapid changes with a 300ms minimum hold time
 * and provides exit/enter animation state.
 */
export function useStepTransition(steps: ValidationStep[]): StepTransitionState {
  const latestStep = steps[steps.length - 1];
  const latestType: ValidationStepType = latestStep?.stepType ?? 'init';
  const latestLabel = deriveLabel(latestStep);

  const [displayed, setDisplayed] = useState<{
    type: ValidationStepType;
    label: string;
  }>({ type: 'init', label: 'Initializing...' });

  const [isTransitioning, setIsTransitioning] = useState(false);
  const lastChangeRef = useRef<number>(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const swapTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Ref to always read the latest label at swap time (avoids stale closures)
  const latestLabelRef = useRef(latestLabel);
  latestLabelRef.current = latestLabel;

  // Effect 1: Same-type label updates — no cleanup, won't disturb pending debounce
  useEffect(() => {
    if (latestType === displayed.type) {
      setDisplayed(prev => ({ ...prev, label: latestLabel }));
    }
  }, [latestType, latestLabel, displayed.type]);

  // Effect 2: Type-change transitions with debounce
  useEffect(() => {
    if (latestType === displayed.type) return;

    const elapsed = Date.now() - lastChangeRef.current;
    const minHold = 300;
    const delay = Math.max(0, minHold - elapsed);

    clearTimeout(timeoutRef.current);
    clearTimeout(swapTimeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setIsTransitioning(true);

      // After exit animation (150ms), swap the illustration
      swapTimeoutRef.current = setTimeout(() => {
        setDisplayed({ type: latestType, label: latestLabelRef.current });
        setIsTransitioning(false);
        lastChangeRef.current = Date.now();
      }, 150);
    }, delay);

    return () => {
      clearTimeout(timeoutRef.current);
      clearTimeout(swapTimeoutRef.current);
    };
  }, [latestType, displayed.type]);

  return {
    currentType: displayed.type,
    currentLabel: displayed.label,
    isTransitioning,
  };
}
