/**
 * useAutoLaunchDecision
 *
 * Given the stored user preference and a classifier result, returns the
 * auto-launch decision for the Rox Design surface.
 *
 * Decision matrix:
 *   choice='always' + confident design → 'always-launch'
 *   choice='ask'    + confident design → 'ask-user'
 *   choice='never'  + any             → 'never-launch'
 *   any choice      + not confident   → 'never-launch'
 *
 * Phase D / T537 PR #4
 */

import { classifyDesignTask, type ClassifierResult } from '@rox-one/design-classifier'

export type { ClassifierResult }

/** Stored user preference for auto-launching Rox Design. */
export type AutoLaunchDesignChoice = 'always' | 'ask' | 'never'

/** Decision returned by this hook. */
export type AutoLaunchDecision = 'always-launch' | 'ask-user' | 'never-launch'

/** Confidence threshold above which the classifier is considered actionable. */
const CONFIDENCE_THRESHOLD = 0.7

/** Minimal shape required by the decision function — a structural subset of ClassifierResult. */
type ClassifierSignal = Pick<ClassifierResult, 'confidence' | 'topClass'>

/**
 * Pure decision function — no React hooks needed for the logic itself.
 * Exported so tests can call it directly without a DOM.
 *
 * Accepts the full ClassifierResult or any structural subset with
 * `confidence` and `topClass` (e.g. test stubs).
 *
 * @param choice   Stored user preference
 * @param result   Classifier output (null/undefined = not run yet)
 */
export function getAutoLaunchDecision(
  choice: AutoLaunchDesignChoice,
  result: ClassifierSignal | null | undefined,
): AutoLaunchDecision {
  // If the classifier hasn't run, or isn't confident, or didn't flag 'design' → no-op
  if (
    !result ||
    result.topClass !== 'design' ||
    result.confidence <= CONFIDENCE_THRESHOLD
  ) {
    return 'never-launch'
  }

  switch (choice) {
    case 'always':
      return 'always-launch'
    case 'ask':
      return 'ask-user'
    case 'never':
      return 'never-launch'
    default:
      return 'never-launch'
  }
}

/**
 * useAutoLaunchDecision (React hook wrapper)
 *
 * Runs the real design classifier on the given prompt and returns the
 * auto-launch decision synchronously.
 * Import pure getAutoLaunchDecision directly if you need to pass a
 * pre-computed ClassifierResult.
 *
 * @param choice  Stored user preference
 * @param prompt  The user's raw prompt text to classify
 */
export function useAutoLaunchDecision(
  choice: AutoLaunchDesignChoice,
  prompt: string,
): AutoLaunchDecision {
  const result = classifyDesignTask(prompt)
  return getAutoLaunchDecision(choice, result)
}
