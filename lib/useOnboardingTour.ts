"use client";

import { useState, useEffect, useCallback } from "react";

export interface TourStep {
  /** CSS selector for the target element (e.g., '[data-tour="filter-btn"]') */
  target: string;
  /** Title shown in the tooltip */
  title: string;
  /** Description/body text */
  description: string;
  /** Position of the tooltip relative to the target */
  position?: "top" | "bottom" | "left" | "right";
}

interface TourState {
  /** Current step data (null if not touring) */
  currentStep: TourStep | null;
  /** Current step index (0-based) */
  stepIndex: number;
  /** Total number of steps */
  totalSteps: number;
  /** Whether the tour is active */
  isTouring: boolean;
  /** Advance to the next step */
  next: () => void;
  /** Go back to the previous step */
  back: () => void;
  /** Skip/dismiss the entire tour */
  skip: () => void;
  /** Restart the tour (clears localStorage flag) */
  restart: () => void;
}

/**
 * useOnboardingTour
 *
 * Manages a one-time onboarding tooltip tour for a page.
 * Stores completion in localStorage so it only shows once.
 *
 * @param pageKey - Unique key for this page tour (e.g., "swipe", "business-dashboard")
 * @param steps - Array of tour steps to display
 * @param delay - Optional delay in ms before starting the tour (default 800ms)
 * @param enabled - Optional flag to defer tour start (e.g., until data loads). Default true.
 */
export function useOnboardingTour(
  pageKey: string,
  steps: TourStep[],
  delay = 800,
  enabled = true
): TourState {
  const storageKey = `toured-${pageKey}`;
  const [stepIndex, setStepIndex] = useState(-1); // -1 = not started
  const [started, setStarted] = useState(false);

  // Check localStorage on mount — start tour only if not completed and enabled
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!enabled) return;
    const toured = localStorage.getItem(storageKey);
    if (toured) return; // Already completed

    const timer = setTimeout(() => {
      setStepIndex(0);
      setStarted(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [storageKey, delay, enabled]);

  const isTouring = started && stepIndex >= 0 && stepIndex < steps.length;

  const next = useCallback(() => {
    const nextIndex = stepIndex + 1;
    if (nextIndex >= steps.length) {
      // Tour complete
      setStepIndex(-1);
      setStarted(false);
      localStorage.setItem(storageKey, "true");
    } else {
      setStepIndex(nextIndex);
    }
  }, [stepIndex, steps.length, storageKey]);

  const back = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  }, [stepIndex]);

  const skip = useCallback(() => {
    setStepIndex(-1);
    setStarted(false);
    localStorage.setItem(storageKey, "true");
  }, [storageKey]);

  const restart = useCallback(() => {
    localStorage.removeItem(storageKey);
    setStepIndex(0);
    setStarted(true);
  }, [storageKey]);

  return {
    currentStep: isTouring ? steps[stepIndex] : null,
    stepIndex: isTouring ? stepIndex : -1,
    totalSteps: steps.length,
    isTouring,
    next,
    back,
    skip,
    restart,
  };
}
