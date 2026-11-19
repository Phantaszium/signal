import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { env } from "@/lib/env";
import { assessmentSchema } from "@/lib/ai/schema";
import { SYSTEM_PROMPT, itemBlock, topicLabel, topicsBlock } from "@/lib/ai/prompt";
import type { AiAssessment, MonitoringTopic, Publication, StudentProfile } from "@/lib/types";

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

const outputFormat = zodOutputFormat(assessmentSchema);

/**
 * Request body for one evaluation, shared by the manual path and the
 * scheduled batch so both judge items identically. Instructions, then the
 * researcher's topics, then the record: the first two are a stable prefix
 * and are cached across every item evaluated for the same user.
 */
export function evaluationParams(topics: MonitoringTopic[], pub: Publication, student?: StudentProfile) {
  return {
    model: env.model(),
    max_tokens: 16000,
    system: [
      { type: "text" as const, text: SYSTEM_PROMPT },
      {
        type: "text" as const,
        text: topicsBlock(topics, student),
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [{ role: "user" as const, content: itemBlock(pub) }],
    output_config: { effort: "medium" as const, format: outputFormat },
  };
}

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export type EvaluationOutcome =
  | { ok: true; assessment: AiAssessment }
  | { ok: false; reason: string };

/**
 * Validate a finished model response into an assessment. `topicIds` are the
 * topics in the order they were labelled in the request (T1, T2, ...), so the
 * model's label can be mapped back to a topic.
 */
export function parseEvaluation(
  message: {
    stop_reason: string | null;
    model: string;
    content: { type: string; text?: string }[];
  },
  topicIds: string[],
): EvaluationOutcome {
  if (message.stop_reason === "refusal") return { ok: false, reason: "declined by model" };
  if (message.stop_reason === "max_tokens") return { ok: false, reason: "response truncated" };
  const text = message.content.find((b) => b.type === "text")?.text;
  if (!text) return { ok: false, reason: "no text in response" };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: "response was not JSON" };
  }
  const parsed = assessmentSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "response did not match schema" };

  const { topic, ...a } = parsed.data;
  const dim = (d: { score: number; reason: string }) => ({
    score: clampScore(d.score),
    reason: d.reason,
  });
  const topicIndex = topicIds.findIndex((_, i) => topicLabel(i) === topic.trim().toUpperCase());
  return {
    ok: true,
    assessment: {
      ...a,
      // An unrecognised label leaves the topic unset; callers fall back to
      // the topic the record was retrieved for.
      topicId: topicIndex >= 0 ? topicIds[topicIndex] : undefined,
      significance: { level: a.significance.level, reason: a.significance.reason },
      relevance: dim(a.relevance),
      novelty: dim(a.novelty),
      evidence: dim(a.evidence),
      strategic: dim(a.strategic),
      model: message.model,
      evaluatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Evaluate one item now. Used for manual checks, where the user is waiting.
 * Server-side fallbacks let a refused request be retried on another model
 * inside the same call instead of failing the item.
 */
export async function evaluateNow(
  topics: MonitoringTopic[],
  pub: Publication,
  student?: StudentProfile,
): Promise<EvaluationOutcome> {
  try {
    const message = await anthropic().beta.messages.create({
      ...evaluationParams(topics, pub, student),
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    return parseEvaluation(
      message,
      topics.map((t) => t.id),
    );
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, reason: "rate limited" };
    if (error instanceof Anthropic.APIError) {
      return { ok: false, reason: `API error ${error.status}` };
    }
    return { ok: false, reason: "network error" };
  }
}

/** Run `task` over `items` with at most `limit` in flight. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
