import type { RunRecord } from "@/lib/monitoring/types";
import type { LibraryEntry } from "@/lib/db/evaluations";
import type {
  DigestFrequency,
  EvaluatedItem,
  MonitoringTopic,
  PreferenceWeights,
  Publication,
  StudentProfile,
} from "@/lib/types";

/** Serializable snapshot handed from the server layout to the client store. */
export interface AppState {
  /** When the snapshot was loaded. Every "new", "this week" and "ago" is relative to it. */
  now: number;
  account: {
    email: string;
    isAdmin: boolean;
    digestFrequency: DigestFrequency;
    alertsEnabled: boolean;
  };
  student: StudentProfile;
  topics: MonitoringTopic[];
  weights: PreferenceWeights;
  /**
   * Assessments at or above the lowest development threshold from the last
   * 120 days, plus every saved item. Whether each one is a development
   * depends on its topic's sensitivity, decided on the client.
   */
  items: EvaluatedItem[];
  /** Recent monitoring runs, newest first. */
  runs: RunRecord[];
  savedIds: string[];
  dismissedIds: string[];
  feedbackCount: number;
  /** Saved, viewed or annotated papers, with reading status and notes. */
  library: LibraryEntry[];
  /** False until migration 0004 has run (reading status and notes unavailable). */
  libraryReady: boolean;
  /**
   * Library papers PaperPuffin has not assessed (saved straight from search),
   * shown with their metadata only.
   */
  unassessed: Publication[];
}
