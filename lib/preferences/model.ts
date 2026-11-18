/**
 * The user-preference model.
 *
 * Feedback nudges a small weight vector; the scoring module reads that vector
 * for the "User preference fit" dimension. This is deliberately a simple
 * online update rather than a learned model — it is legible, it demonstrably
 * changes ranking, and it can be swapped for something real later without
 * changing any call site.
 */

import { LEARNED_PREFERENCES, NEUTRAL_PREFERENCE_WEIGHTS } from "@/lib/data/profile";
import type {
  FeedbackAction,
  LearnedPreference,
  PreferenceKey,
  PreferenceWeights,
  Publication,
} from "@/lib/types";

/** How strongly each action moves the weights. */
const ACTION_STRENGTH: Record<FeedbackAction, number> = {
  important: 0.05,
  save: 0.025,
  read: 0.01,
  not_relevant: -0.05,
};

const MIN_WEIGHT = 0.15;
const MAX_WEIGHT = 0.98;

const clampWeight = (n: number) => Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, n));

/** Which preference keys a publication provides evidence about. */
export function activeKeysFor(pub: Publication): PreferenceKey[] {
  const s = pub.signals ?? {};
  const keys: PreferenceKey[] = [];
  if (s.mechanistic) keys.push("mechanistic");
  if (s.acquiredResistance) keys.push("acquiredResistance");
  if (s.negativeResult) keys.push("negativeResults");
  if (s.clinical) keys.push("clinical");
  if (pub.type === "preprint") keys.push("preprints");
  // "Not relevant" on an in-vitro-only paper is evidence the discount is right,
  // so this key moves in the opposite direction from the others.
  if (s.inVitroOnly) keys.push("discountInVitroOnly");
  return keys;
}

export function applyFeedback(
  weights: PreferenceWeights,
  pub: Publication,
  action: FeedbackAction,
): PreferenceWeights {
  const delta = ACTION_STRENGTH[action];
  const next: PreferenceWeights = { ...weights };
  for (const key of activeKeysFor(pub)) {
    // The in-vitro discount is a *penalty* weight: dismissing an in-vitro-only
    // paper should strengthen it, not weaken it.
    const signed = key === "discountInVitroOnly" ? -delta : delta;
    next[key] = clampWeight(next[key] + signed);
  }
  return next;
}

/**
 * Render the current weights as the "What PaperPuffin has learned" statements.
 * Confidence tracks the weight so the panel visibly moves as feedback lands.
 */
export function deriveLearnedPreferences(
  weights: PreferenceWeights,
): LearnedPreference[] {
  return LEARNED_PREFERENCES.map((pref) => ({
    ...pref,
    confidence: Number(weights[pref.key].toFixed(2)),
  }));
}

/** Preferences that have moved away from the neutral starting point. */
export function changedPreferences(weights: PreferenceWeights): PreferenceKey[] {
  return (Object.keys(weights) as PreferenceKey[]).filter(
    (k) => Math.abs(weights[k] - NEUTRAL_PREFERENCE_WEIGHTS[k]) > 0.005,
  );
}

export { NEUTRAL_PREFERENCE_WEIGHTS };
