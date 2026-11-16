"use client";

/**
 * Client store for the signed-in app.
 *
 * The server layout loads the account's topics, recent assessments, runs and
 * feedback state; this provider ranks the assessments against the learned
 * preference weights and decides which are developments. Feedback is applied
 * optimistically so lists re-rank immediately, then reconciled with the
 * server's answer.
 */

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordFeedbackAction } from "@/app/(app)/actions";
import { byPriority, toDevelopment, type Development } from "@/lib/developments";
import type { RunRecord } from "@/lib/monitoring/types";
import { applyFeedback, deriveLearnedPreferences } from "@/lib/preferences/model";
import { rankEvaluated } from "@/lib/ranking/scoring";
import type { AppState } from "@/lib/store/app-state";
import type {
  FeedbackAction,
  LearnedPreference,
  MonitoringTopic,
  PreferenceWeights,
} from "@/lib/types";

interface SignalContextValue {
  /** When the data was loaded; use instead of Date.now() during render. */
  now: number;
  account: AppState["account"];
  topics: MonitoringTopic[];
  activeTopics: MonitoringTopic[];
  topicById: Map<string, MonitoringTopic>;
  weights: PreferenceWeights;
  learned: LearnedPreference[];
  runs: RunRecord[];
  /** The newest run if it is still in progress. */
  running: RunRecord | null;
  /** Every loaded assessment, ranked, newest first. Includes non-developments. */
  allItems: Development[];
  /** Assessments that clear their topic's threshold and were not dismissed, newest first. */
  developments: Development[];
  savedIds: string[];
  dismissedIds: string[];
  savedItems: Development[];
  feedbackCount: number;
  recordFeedback: (publicationId: string, action: FeedbackAction) => void;
  getItem: (id: string) => Development | undefined;
}

const SignalContext = createContext<SignalContextValue | null>(null);

export function SignalProvider({
  initial,
  children,
}: {
  initial: AppState;
  children: React.ReactNode;
}) {
  const [weights, setWeights] = useState(initial.weights);
  const [savedIds, setSavedIds] = useState(initial.savedIds);
  const [dismissedIds, setDismissedIds] = useState(initial.dismissedIds);
  const [feedbackCount, setFeedbackCount] = useState(initial.feedbackCount);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // A new server snapshot (after router.refresh or navigation) replaces the
  // local copy. React's "adjust state during render" pattern.
  const [synced, setSynced] = useState(initial);
  if (synced !== initial) {
    setSynced(initial);
    setWeights(initial.weights);
    setSavedIds(initial.savedIds);
    setDismissedIds(initial.dismissedIds);
    setFeedbackCount(initial.feedbackCount);
  }

  const topicById = useMemo(() => new Map(initial.topics.map((t) => [t.id, t])), [initial.topics]);

  const allItems = useMemo(
    () =>
      initial.items
        .map((i) => toDevelopment(i, i.topicId ? topicById.get(i.topicId) : undefined, weights))
        .sort((a, b) => Date.parse(b.evaluatedAt) - Date.parse(a.evaluatedAt) || byPriority(a, b)),
    [initial.items, topicById, weights],
  );

  const developments = useMemo(() => {
    const dismissed = new Set(dismissedIds);
    return allItems.filter((d) => d.isDevelopment && !dismissed.has(d.publication.id));
  }, [allItems, dismissedIds]);

  const getItem = useCallback(
    (id: string) => allItems.find((d) => d.publication.id === id),
    [allItems],
  );

  const recordFeedback = useCallback(
    (publicationId: string, action: FeedbackAction) => {
      // Optimistic: re-rank now, reconcile when the server answers. Items
      // not in this snapshot only update when the server answers.
      const item = initial.items.find((i) => i.publication.id === publicationId);
      if (item) {
        setWeights((w) => applyFeedback(w, rankEvaluated(item, w).publication, action));
      }
      if (action === "save") {
        setSavedIds((ids) =>
          ids.includes(publicationId) ? ids.filter((x) => x !== publicationId) : [...ids, publicationId],
        );
      }
      if (action === "not_relevant") {
        setDismissedIds((ids) =>
          ids.includes(publicationId) ? ids.filter((x) => x !== publicationId) : [...ids, publicationId],
        );
      }
      setFeedbackCount((n) => n + 1);

      startTransition(async () => {
        const result = await recordFeedbackAction(publicationId, action);
        if (!result) return;
        if (!item) router.refresh();
        setWeights(result.weights);
        setSavedIds((ids) => {
          const rest = ids.filter((x) => x !== publicationId);
          return result.saved ? [...rest, publicationId] : rest;
        });
        setDismissedIds((ids) => {
          const rest = ids.filter((x) => x !== publicationId);
          return result.dismissed ? [...rest, publicationId] : rest;
        });
      });
    },
    [initial.items, router],
  );

  const value = useMemo<SignalContextValue>(() => {
    const newest = initial.runs[0];
    return {
      now: initial.now,
      account: initial.account,
      topics: initial.topics,
      activeTopics: initial.topics.filter((t) => t.active),
      topicById,
      weights,
      learned: deriveLearnedPreferences(weights),
      runs: initial.runs,
      running: newest && (newest.status === "running" || newest.status === "evaluating") ? newest : null,
      allItems,
      developments,
      savedIds,
      dismissedIds,
      savedItems: allItems.filter((d) => savedIds.includes(d.publication.id)),
      feedbackCount,
      recordFeedback,
      getItem,
    };
  }, [initial, topicById, weights, allItems, developments, savedIds, dismissedIds, feedbackCount, recordFeedback, getItem]);

  return <SignalContext.Provider value={value}>{children}</SignalContext.Provider>;
}

export function useSignal(): SignalContextValue {
  const ctx = useContext(SignalContext);
  if (!ctx) throw new Error("useSignal must be used inside SignalProvider");
  return ctx;
}
