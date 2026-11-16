import "server-only";

import type { Account } from "@/lib/db/accounts";
import {
  feedbackCount,
  getItemState,
  itemsByIds,
  itemsForBriefing,
  latestBriefing,
} from "@/lib/db/briefings";
import type { AppState } from "@/lib/store/app-state";

/** Everything the signed-in app shell needs, loaded once per navigation. */
export async function loadAppState(account: Account): Promise<AppState> {
  const [ready, latest, state, feedback] = await Promise.all([
    latestBriefing(account.id, { readyOnly: true }),
    latestBriefing(account.id),
    getItemState(account.id),
    feedbackCount(account.id),
  ]);

  const [briefingItems, savedItems] = await Promise.all([
    ready ? itemsForBriefing(account.id, ready.id) : Promise.resolve([]),
    itemsByIds(account.id, state.savedIds),
  ]);

  const items = new Map(briefingItems.map((i) => [i.publication.id, i]));
  for (const i of savedItems) if (!items.has(i.publication.id)) items.set(i.publication.id, i);

  return {
    account: {
      email: account.email,
      isAdmin: account.isAdmin,
      emailDigest: account.emailDigest,
    },
    profile: account.researchProfile!,
    weights: account.weights,
    items: [...items.values()],
    briefing: ready
      ? {
          id: ready.id,
          mode: ready.mode,
          createdAt: ready.createdAt,
          scanned: ready.funnel.scanned,
          sourceCounts: ready.sourceCounts,
        }
      : null,
    running:
      latest && latest.status === "evaluating" ? { id: latest.id, mode: latest.mode } : null,
    lastFailure:
      latest && latest.status === "failed" ? (latest.error ?? "The last briefing failed.") : null,
    savedIds: state.savedIds,
    dismissedIds: state.dismissedIds,
    feedbackCount: feedback,
  };
}
