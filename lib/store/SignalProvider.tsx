"use client";

/**
 * Single client-side store for profile, preferences and feedback.
 *
 * Ranking runs here rather than on the server so that feedback re-ranks the
 * briefing immediately — that live response is the point of the demo.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_PREFERENCE_WEIGHTS,
  DEFAULT_PROFILE,
} from "@/lib/data/profile";
import { SEED_PUBLICATIONS } from "@/lib/data/seed-papers";
import { applyFeedback, deriveLearnedPreferences } from "@/lib/preferences/model";
import { buildWhyThisMatters } from "@/lib/ranking/explain";
import {
  MAX_HIGH_ITEMS,
  RELEVANCE_FLOOR,
  scorePublication,
} from "@/lib/ranking/scoring";
import { DEMO_SCAN_VOLUME } from "@/lib/constants";
import { localRepository, type SignalState } from "@/lib/store/persistence";
import type {
  Briefing,
  FeedbackAction,
  LearnedPreference,
  Publication,
  ResearchProfile,
  ScoredPublication,
} from "@/lib/types";

interface SignalContextValue extends SignalState {
  learned: LearnedPreference[];
  /** Every candidate, ranked — the briefing is a view over this. */
  ranked: ScoredPublication[];
  briefing: Briefing;
  savedItems: ScoredPublication[];
  /** Live PubMed items merged in by "Generate Today's Briefing". */
  liveItems: Publication[];
  lastGeneratedAt: string | null;
  sourceNote: string;
  recordFeedback: (publicationId: string, action: FeedbackAction) => void;
  updateProfile: (profile: ResearchProfile) => void;
  ingestLive: (items: Publication[], note: string, scanVolume: number) => void;
  resetAll: () => void;
  getScored: (id: string) => ScoredPublication | undefined;
}

const SignalContext = createContext<SignalContextValue | null>(null);

const DEFAULT_SOURCE_NOTE =
  "Demo corpus — fictional but scientifically plausible records.";

const INITIAL_STATE: SignalState = {
  profile: DEFAULT_PROFILE,
  weights: DEFAULT_PREFERENCE_WEIGHTS,
  feedback: [],
  savedIds: [],
  dismissedIds: [],
};

export function SignalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SignalState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [liveItems, setLiveItems] = useState<Publication[]>([]);
  const [scanVolume, setScanVolume] = useState(DEMO_SCAN_VOLUME);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [sourceNote, setSourceNote] = useState(DEFAULT_SOURCE_NOTE);

  // Hydrate from localStorage after mount. This has to be an effect: reading
  // storage during render would produce a server/client markup mismatch.
  useEffect(() => {
    const stored = localRepository.load();
    const ingestion = localRepository.loadIngestion();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from an external store
    if (stored) setState({ ...INITIAL_STATE, ...stored });
    if (ingestion) {
      setLiveItems(ingestion.items);
      setScanVolume(ingestion.scanVolume);
      setSourceNote(ingestion.sourceNote);
      setLastGeneratedAt(ingestion.generatedAt);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localRepository.save(state);
  }, [state, hydrated]);

  const corpus = useMemo<Publication[]>(() => {
    if (!liveItems.length) return SEED_PUBLICATIONS;
    const seen = new Set(SEED_PUBLICATIONS.map((p) => p.id));
    return [...liveItems.filter((p) => !seen.has(p.id)), ...SEED_PUBLICATIONS];
  }, [liveItems]);

  const ranked = useMemo(() => {
    return corpus
      .map((pub) => {
        const scored = scorePublication(pub, {
          profile: state.profile,
          weights: state.weights,
        });
        return { ...scored, whyThisMatters: buildWhyThisMatters(scored, state.profile) };
      })
      .sort((a, b) => b.signalScore - a.signalScore);
  }, [corpus, state.profile, state.weights]);

  const briefing = useMemo<Briefing>(() => {
    const dismissed = new Set(state.dismissedIds);
    const relevant = ranked.filter(
      (s) =>
        !dismissed.has(s.publication.id) &&
        s.scores.researchRelevance >= RELEVANCE_FLOOR,
    );
    const high = relevant.slice(0, MAX_HIGH_ITEMS).filter((s) => s.tier === "HIGH");
    const highIds = new Set(high.map((s) => s.publication.id));
    const rest = relevant.filter((s) => !highIds.has(s.publication.id));

    return {
      generatedAt: lastGeneratedAt ?? new Date(0).toISOString(),
      funnel: {
        ingested: scanVolume,
        likelyRelevant: relevant.length,
        important: high.length,
      },
      high,
      notable: rest.filter((s) => s.tier !== "CONTEXT"),
      context: rest.filter((s) => s.tier === "CONTEXT"),
      sourceMode: liveItems.length ? "pubmed+seed" : "seed",
      sourceNote,
    };
  }, [ranked, state.dismissedIds, scanVolume, lastGeneratedAt, liveItems.length, sourceNote]);

  const recordFeedback = useCallback(
    (publicationId: string, action: FeedbackAction) => {
      setState((prev) => {
        const pub = [...SEED_PUBLICATIONS, ...liveItems].find(
          (p) => p.id === publicationId,
        );
        if (!pub) return prev;

        const savedIds =
          action === "save"
            ? prev.savedIds.includes(publicationId)
              ? prev.savedIds.filter((id) => id !== publicationId)
              : [...prev.savedIds, publicationId]
            : prev.savedIds;

        const dismissedIds =
          action === "not_relevant"
            ? prev.dismissedIds.includes(publicationId)
              ? prev.dismissedIds.filter((id) => id !== publicationId)
              : [...prev.dismissedIds, publicationId]
            : prev.dismissedIds;

        return {
          ...prev,
          weights: applyFeedback(prev.weights, pub, action),
          savedIds,
          dismissedIds,
          feedback: [
            { publicationId, action, at: new Date().toISOString() },
            ...prev.feedback,
          ].slice(0, 200),
        };
      });
    },
    [liveItems],
  );

  const updateProfile = useCallback((profile: ResearchProfile) => {
    setState((prev) => ({ ...prev, profile }));
  }, []);

  const ingestLive = useCallback(
    (items: Publication[], note: string, volume: number) => {
      const generatedAt = new Date().toISOString();
      setLiveItems(items);
      setSourceNote(note);
      setScanVolume(volume);
      setLastGeneratedAt(generatedAt);
      // Cached so a reload, or opening a live item by URL, still resolves.
      localRepository.saveIngestion({
        items,
        scanVolume: volume,
        sourceNote: note,
        generatedAt,
      });
    },
    [],
  );

  const resetAll = useCallback(() => {
    localRepository.clear();
    setState(INITIAL_STATE);
    setLiveItems([]);
    setScanVolume(DEMO_SCAN_VOLUME);
    setLastGeneratedAt(null);
    setSourceNote(DEFAULT_SOURCE_NOTE);
  }, []);

  const value = useMemo<SignalContextValue>(
    () => ({
      ...state,
      learned: deriveLearnedPreferences(state.weights),
      ranked,
      briefing,
      savedItems: ranked.filter((s) => state.savedIds.includes(s.publication.id)),
      liveItems,
      lastGeneratedAt,
      sourceNote,
      recordFeedback,
      updateProfile,
      ingestLive,
      resetAll,
      getScored: (id: string) => ranked.find((s) => s.publication.id === id),
    }),
    [
      state,
      ranked,
      briefing,
      liveItems,
      lastGeneratedAt,
      sourceNote,
      recordFeedback,
      updateProfile,
      ingestLive,
      resetAll,
    ],
  );

  return <SignalContext.Provider value={value}>{children}</SignalContext.Provider>;
}

export function useSignal(): SignalContextValue {
  const ctx = useContext(SignalContext);
  if (!ctx) throw new Error("useSignal must be used inside SignalProvider");
  return ctx;
}
