import "server-only";

import { anthropic, evaluationParams, parseEvaluation, type EvaluationOutcome } from "@/lib/ai/evaluate";
import type { Publication, ResearchProfile } from "@/lib/types";

export interface BatchRequest {
  /** Must be unique within the batch; used to match results back. */
  customId: string;
  profile: ResearchProfile;
  publication: Publication;
}

/**
 * Submit the night's evaluations as one Message Batch: half the price of
 * individual calls, and no serverless timeout to fit inside. Results usually
 * arrive within an hour; `collectBatch` picks them up.
 */
export async function submitBatch(requests: BatchRequest[]): Promise<string> {
  const batch = await anthropic().messages.batches.create({
    requests: requests.map((r) => ({
      custom_id: r.customId,
      params: evaluationParams(r.profile, r.publication),
    })),
  });
  return batch.id;
}

export type BatchStatus =
  | { done: false }
  | { done: true; results: Map<string, EvaluationOutcome> };

export async function collectBatch(batchId: string): Promise<BatchStatus> {
  const batch = await anthropic().messages.batches.retrieve(batchId);
  if (batch.processing_status !== "ended") return { done: false };

  const results = new Map<string, EvaluationOutcome>();
  for await (const entry of await anthropic().messages.batches.results(batchId)) {
    // Keyed by custom_id: batch results arrive in any order.
    if (entry.result.type === "succeeded") {
      results.set(entry.custom_id, parseEvaluation(entry.result.message));
    } else {
      results.set(entry.custom_id, { ok: false, reason: `batch ${entry.result.type}` });
    }
  }
  return { done: true, results };
}
