"use client";

/**
 * Client store for the signed-in app.
 *
 * The server layout loads the account's latest briefing, assessments and
 * feedback state; this provider ranks them against the learned preference
 * weights. Feedback is applied optimistically so the briefing re-ranks
 * immediately, then reconciled with the server's answer.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { recordFeedbackAction } from "@/app/(app)/actions";
import { applyFeedback, deriveLearnedPreferences } from "@/lib/preferences/model";
import { rankBriefing, rankEvaluated } from "@/lib/ranking/scoring";
import type { AppState } from "@/lib/store/app-state";
import type {
  Briefing,
  FeedbackAction,
  LearnedPreference,
  PreferenceWeights,
  ScoredPublication,
} from "@/lib/types";

interface SignalContextValue {
  account: AppState["account"];
  profile: AppState["profile"];
  weights: PreferenceWeights;
  learned: LearnedPreference[];
  briefing: Briefing;
  hasBriefing: boolean;
  running: AppState["running"];
  lastFailure: string | null;
  briefingMeta: AppState["briefing"];
  savedIds: string[];
  dismissedIds: string[];
  savedItems: ScoredPublication[];
  /** Every loaded item, ranked: the latest briefing plus saved items. */
  allItems: ScoredPublication[];
  feedbackCount: number;
  recordFeedback: (publicationId: string, action: FeedbackAction) => void;
  getScored: (id: string) => ScoredPublication | undefined;
}

const SignalContext = createContext<SignalContextValue | null>(null);

function sourceNote(meta: AppState["briefing"]): string {
  if (!meta) return "No briefing yet.";
  const when = new Date(meta.createdAt).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const sources = [
    ["PubMed", meta.sourceCounts.pubmed],
    ["bioRxiv", meta.sourceCounts.biorxiv],
    ["medRxiv", meta.sourceCounts.medrxiv],
    ["ClinicalTrials.gov", meta.sourceCounts.clinicaltrials],
  ]
    .filter(([, n]) => typeof n === "number")
    .map(([name]) => name)
    .join(", ");
  const kind = meta.mode === "nightly" ? "Overnight sweep" : "On-demand briefing";
  return `${kind}, ${when}${sources ? ` · ${sources}` : ""}`;
}

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

  const briefingItems = useMemo(
    () =>
      initial.briefing
        ? initial.items.filter((i) => i.briefingId === initial.briefing!.id)
        : [],
    [initial.items, initial.briefing],
  );

  const briefing = useMemo<Briefing>(() => {
    const ranked = rankBriefing(briefingItems, weights, new Set(dismissedIds));
    return {
      generatedAt: initial.briefing?.createdAt ?? new Date(0).toISOString(),
      funnel: {
        ingested: initial.briefing?.scanned ?? 0,
        likelyRelevant: ranked.relevant.length,
        important: ranked.high.length,
      },
      high: ranked.high,
      notable: ranked.notable,
      context: ranked.context,
      sourceNote: sourceNote(initial.briefing),
    };
  }, [briefingItems, weights, dismissedIds, initial.briefing]);

  const getScored = useCallback(
    (id: string) => {
      const item = initial.items.find((i) => i.publication.id === id);
      return item ? rankEvaluated(item, weights) : undefined;
    },
    [initial.items, weights],
  );

  const recordFeedback = useCallback(
    (publicationId: string, action: FeedbackAction) => {
      // Optimistic: re-rank now, reconcile when the server answers. Items
      // opened from an older briefing are not in the store, so for those only
      // the server's answer updates the weights.
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
        // Items from older briefings are not in this snapshot; reload it so
        // pages like /saved pick them up.
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

  const value = useMemo<SignalContextValue>(
    () => ({
      account: initial.account,
      profile: initial.profile,
      weights,
      learned: deriveLearnedPreferences(weights),
      briefing,
      hasBriefing: Boolean(initial.briefing),
      running: initial.running,
      lastFailure: initial.lastFailure,
      briefingMeta: initial.briefing,
      savedIds,
      dismissedIds,
      savedItems: initial.items
        .filter((i) => savedIds.includes(i.publication.id))
        .map((i) => rankEvaluated(i, weights)),
      allItems: initial.items
        .map((i) => rankEvaluated(i, weights))
        .sort((a, b) => b.signalScore - a.signalScore),
      feedbackCount,
      recordFeedback,
      getScored,
    }),
    [initial, weights, briefing, savedIds, dismissedIds, feedbackCount, recordFeedback, getScored],
  );

  return <SignalContext.Provider value={value}>{children}</SignalContext.Provider>;
}

export function useSignal(): SignalContextValue {
  const ctx = useContext(SignalContext);
  if (!ctx) throw new Error("useSignal must be used inside SignalProvider");
  return ctx;
}
