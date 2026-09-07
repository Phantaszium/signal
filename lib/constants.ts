/**
 * Shared constants safe to import from both client and server code.
 *
 * Kept separate from lib/ingestion/pipeline.ts so that client components never
 * pull the PubMed client (which reads a server-only API key) into their module
 * graph. See the `server-only` guard at the top of lib/ingestion/pubmed.ts.
 */

/**
 * Demo scan volume — the headline funnel number when running on the seeded
 * corpus. Signal's real ingest would report the true count of items pulled
 * from all feeds; this stands in for it and is the single place to change it.
 */
export const DEMO_SCAN_VOLUME = 1248;
