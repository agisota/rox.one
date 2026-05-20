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
 *
 * TODO(phase-c-integration): replace ClassifierResult stub with
 * @rox-one/design-classifier import when the Phase C package is published.
 */

/** Stored user preference for auto-launching Rox Design. */
export type AutoLaunchDesignChoice = 'always' | 'ask' | 'never'

/** Decision returned by this hook. */
export type AutoLaunchDecision = 'always-launch' | 'ask-user' | 'never-launch'

// TODO(phase-c-integration): replace with @rox-one/design-classifier import when published
export type ClassifierResult = {
  confidence: number
  topClass: 'design' | 'other'
}

/** Confidence threshold above which the classifier is considered actionable. */
const CONFIDENCE_THRESHOLD = 0.7

/**
 * Pure decision function — no React hooks needed for the logic itself.
 * Exported so tests can call it directly without a DOM.
 *
 * @param choice   Stored user preference
 * @param result   Classifier output (null/undefined = not run yet)
 */
export function getAutoLaunchDecision(
  choice: AutoLaunchDesignChoice,
  result: ClassifierResult | null | undefined,
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
 * Returns the decision synchronously from the pure function.
 * Import pure getAutoLaunchDecision directly if you don't need the React hook.
 */
export function useAutoLaunchDecision(
  choice: AutoLaunchDesignChoice,
  result: ClassifierResult | null | undefined,
): AutoLaunchDecision {
  return getAutoLaunchDecision(choice, result)
}
