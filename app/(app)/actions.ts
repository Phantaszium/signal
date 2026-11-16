"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireReadyAccount } from "@/lib/auth/session";
import { updateAccount } from "@/lib/db/accounts";
import { getItemState, itemsByIds, recordFeedbackEvent, setItemState } from "@/lib/db/briefings";
import { applyFeedback } from "@/lib/preferences/model";
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
  if (!item) return null;
  const current = {
    saved: state.savedIds.includes(item.publication.id),
    dismissed: state.dismissedIds.includes(item.publication.id),
  };

  const scored = rankEvaluated(item, account.weights);
  const weights = applyFeedback(account.weights, scored.publication, parsedAction);
  const saved = parsedAction === "save" ? !current.saved : current.saved;
  const dismissed = parsedAction === "not_relevant" ? !current.dismissed : current.dismissed;

  await Promise.all([
    updateAccount(account.id, { weights }),
    recordFeedbackEvent(account.id, item.publication.id, parsedAction),
    parsedAction === "save" || parsedAction === "not_relevant"
      ? setItemState(account.id, item.publication.id, { saved, dismissed })
      : Promise.resolve(),
  ]);
  return { weights, saved, dismissed };
}

export async function setEmailDigestAction(enabled: boolean): Promise<void> {
  const account = await requireReadyAccount();
  await updateAccount(account.id, { emailDigest: Boolean(enabled) });
  revalidatePath("/settings");
}
