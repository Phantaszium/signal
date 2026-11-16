import type { EvaluatedItem, PreferenceWeights, ResearchProfile } from "@/lib/types";

/** Serializable snapshot handed from the server layout to the client store. */
export interface AppState {
  account: { email: string; isAdmin: boolean; emailDigest: boolean };
  profile: ResearchProfile;
  weights: PreferenceWeights;
  /** Items in the latest ready briefing, plus every saved item. */
  items: EvaluatedItem[];
  briefing: {
    id: string;
    mode: "nightly" | "on_demand";
    createdAt: string;
    scanned: number;
    sourceCounts: Record<string, number>;
  } | null;
  running: { id: string; mode: "nightly" | "on_demand" } | null;
  lastFailure: string | null;
  savedIds: string[];
  dismissedIds: string[];
  feedbackCount: number;
}
