import "server-only";

/**
 * Shared HTTP plumbing for the ingestion adapters.
 *
 * Every adapter runs against one shared deadline (epoch ms) so a slow source
 * cannot push the whole ingestion past the serverless function limit.
 */

import type { Publication } from "@/lib/types";

/** Below this, there is not enough time left for a request to be useful. */
const MIN_USEFUL_MS = 300;

/** What one source returned for a time window. */
export interface SourceResult {
  publications: Publication[];
  /** Records the source reported/returned for the window, before any filtering. */
  scanned: number;
}

/**
 * fetch() bounded by both a per-call timeout and the shared deadline.
 * Throws when the budget is exhausted or the request aborts.
 */
export async function fetchWithDeadline(
  url: string,
  deadline: number,
  perCallTimeoutMs = 10000,
): Promise<Response> {
  const remaining = deadline - Date.now();
  if (remaining < MIN_USEFUL_MS) {
    throw new Error("ingestion: time budget exhausted");
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Math.min(perCallTimeoutMs, remaining),
  );
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/** Collapse runs of whitespace (including newlines) into single spaces. */
export function collapseWhitespace(text: string | undefined | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** A ~220-character teaser with an ellipsis, or the fallback when empty. */
export function teaser(text: string, fallback: string, max = 220): string {
  if (!text) return fallback;
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}
