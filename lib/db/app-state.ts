import "server-only";

import type { Account } from "@/lib/db/accounts";
import { currentTopics } from "@/lib/auth/session";
import { feedbackCount, getItemState, itemsByIds, publicationsByIds, recentItems } from "@/lib/db/evaluations";
import { recentRuns } from "@/lib/db/runs";
import { RELEVANCE_THRESHOLD } from "@/lib/developments";
import type { AppState } from "@/lib/store/app-state";

/** How far back the dashboard and activity feed read. */
const HISTORY_DAYS = 120;

/** Everything the signed-in app shell needs, loaded once per navigation. */
export async function loadAppState(account: Account): Promise<AppState> {
  const now = Date.now();
  const [topics, recent, runs, state, feedback] = await Promise.all([
    currentTopics(account.id),
    recentItems(account.id, {
      since: new Date(now - HISTORY_DAYS * 86_400_000),
      minRelevance: Math.min(...Object.values(RELEVANCE_THRESHOLD)),
      limit: 300,
    }),
    recentRuns(account.id, { limit: 10 }),
    getItemState(account.id),
    feedbackCount(account.id),
  ]);

  const items = new Map(recent.map((i) => [i.publication.id, i]));
  // Library papers outside the recent window: assessed ones load with their
  // assessment, papers saved straight from search load as metadata only.
  const libraryIds = [...new Set([...state.savedIds, ...state.library.map((e) => e.publicationId)])];
  const missing = libraryIds.filter((id) => !items.has(id));
  for (const i of await itemsByIds(account.id, missing)) items.set(i.publication.id, i);
  const unassessed = await publicationsByIds(missing.filter((id) => !items.has(id)));

  return {
    now,
    account: {
      email: account.email,
      isAdmin: account.isAdmin,
      digestFrequency: account.digestFrequency,
      alertsEnabled: account.alertsEnabled,
    },
    student: account.student,
    topics,
    weights: account.weights,
    items: [...items.values()],
    runs,
    savedIds: state.savedIds,
    dismissedIds: state.dismissedIds,
    feedbackCount: feedback,
    library: state.library,
    libraryReady: state.libraryReady,
    unassessed,
  };
}
