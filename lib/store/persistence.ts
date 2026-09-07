/**
 * Client persistence.
 *
 * A single narrow interface so the demo can run with zero infrastructure.
 * Swapping in Supabase later means implementing `SignalRepository` against
 * Postgres and changing the export below — no component touches storage.
 */

import type {
  FeedbackEvent,
  PreferenceWeights,
  Publication,
  ResearchProfile,
} from "@/lib/types";

export interface SignalState {
  profile: ResearchProfile;
  weights: PreferenceWeights;
  feedback: FeedbackEvent[];
  savedIds: string[];
  dismissedIds: string[];
}

/**
 * Results of the last live ingestion, persisted so that reloading the page or
 * opening a live item by URL still resolves. Kept separate from SignalState
 * because it is cached source data, not user state.
 */
export interface IngestionSnapshot {
  items: Publication[];
  scanVolume: number;
  sourceNote: string;
  generatedAt: string;
}

export interface SignalRepository {
  load(): SignalState | null;
  save(state: SignalState): void;
  loadIngestion(): IngestionSnapshot | null;
  saveIngestion(snapshot: IngestionSnapshot | null): void;
  clear(): void;
}

const STORAGE_KEY = "signal.state.v1";
const INGESTION_KEY = "signal.ingestion.v1";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked — the demo still works, it just will not persist.
  }
}

export const localRepository: SignalRepository = {
  load: () => read<SignalState>(STORAGE_KEY),
  save: (state) => write(STORAGE_KEY, state),
  loadIngestion: () => read<IngestionSnapshot>(INGESTION_KEY),
  saveIngestion: (snapshot) => write(INGESTION_KEY, snapshot),
  clear() {
    write(STORAGE_KEY, null);
    write(INGESTION_KEY, null);
  },
};
