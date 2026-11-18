"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireReadyAccount } from "@/lib/auth/session";
import { DIGEST_FREQUENCIES, updateAccount } from "@/lib/db/accounts";
import {
  getItemState,
  itemsByIds,
  publicationsByIds,
  recordFeedbackEvent,
  setItemState,
} from "@/lib/db/evaluations";
import { NEUTRAL_PREFERENCE_WEIGHTS, applyFeedback } from "@/lib/preferences/model";
import { rankEvaluated } from "@/lib/ranking/scoring";
import type { FeedbackAction, PreferenceWeights } from "@/lib/types";

const actionSchema = z.enum(["important", "save", "not_relevant", "read"]);

export interface FeedbackResult {
  weights: PreferenceWeights;
  saved: boolean;
  dismissed: boolean;
}

/**
 * Record feedback on an item: toggles saved/dismissed, logs the event and
 * nudges the preference weights. Returns the authoritative result so the
 * client can reconcile its optimistic update.
 */
export async function recordFeedbackAction(
  publicationId: string,
  action: FeedbackAction,
): Promise<FeedbackResult | null> {
  const account = await requireReadyAccount();
  const parsedAction = actionSchema.parse(action);
  const [[item], state] = await Promise.all([
    itemsByIds(account.id, [String(publicationId)]),
    getItemState(account.id),
  ]);
  const [stored] = item ? [item.publication] : await publicationsByIds([String(publicationId)]);
  if (!stored) return null;
  const current = {
    saved: state.savedIds.includes(stored.id),
    dismissed: state.dismissedIds.includes(stored.id),
  };

  // Only assessed papers carry the traits the preference model learns from.
  const weights = item
    ? applyFeedback(account.weights, rankEvaluated(item, account.weights).publication, parsedAction)
    : account.weights;
  const saved = parsedAction === "save" ? !current.saved : current.saved;
  const dismissed = parsedAction === "not_relevant" ? !current.dismissed : current.dismissed;

  await Promise.all([
    item ? updateAccount(account.id, { weights }) : Promise.resolve(),
    recordFeedbackEvent(account.id, stored.id, parsedAction),
    parsedAction === "save" || parsedAction === "not_relevant"
      ? setItemState(account.id, stored.id, {
          saved,
          dismissed,
          ...(parsedAction === "save" && saved ? { readingStatus: "to_read" as const } : {}),
        })
      : Promise.resolve(),
  ]);
  return { weights, saved, dismissed };
}

const digestSchema = z.object({
  digestFrequency: z.enum(DIGEST_FREQUENCIES as [string, ...string[]]),
  alertsEnabled: z.boolean(),
});

export async function setDigestSettingsAction(input: unknown): Promise<{ ok: boolean }> {
  const account = await requireReadyAccount();
  const parsed = digestSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  await updateAccount(account.id, {
    digestFrequency: parsed.data.digestFrequency as (typeof DIGEST_FREQUENCIES)[number],
    alertsEnabled: parsed.data.alertsEnabled,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Forget what PaperPuffin has learned from feedback: back to neutral ranking. */
export async function resetPreferencesAction(): Promise<{ ok: boolean }> {
  const account = await requireReadyAccount();
  await updateAccount(account.id, { weights: { ...NEUTRAL_PREFERENCE_WEIGHTS } });
  revalidatePath("/", "layout");
  return { ok: true };
}
