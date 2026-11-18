"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { evaluateNow } from "@/lib/ai/evaluate";
import { generateGuide } from "@/lib/ai/student";
import { requireReadyAccount } from "@/lib/auth/session";
import { listTopics } from "@/lib/db/topics";
import {
  countDirectAssessments,
  itemsByIds,
  publicationsByIds,
  saveDirectAssessment,
  saveGuide,
  setItemState,
  upsertPublications,
} from "@/lib/db/evaluations";
import { lookupPaper, searchLiterature, type SearchHit } from "@/lib/ingestion/europepmc";
import type { PaperGuide, Publication } from "@/lib/types";

/** On-demand "Explain this paper" assessments per user per day: the cost guard. */
const DAILY_EXPLAIN_LIMIT = Number(process.env.PAPERPUFFIN_DAILY_EXPLAINS) || 25;

type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

// ------------------------------------------------------------------ search

const searchSchema = z.object({
  query: z.string().trim().min(1).max(400),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(["all", "journal", "preprint"]).default("all"),
  openAccessOnly: z.boolean().default(false),
  journal: z.string().max(200).optional(),
  sort: z.enum(["relevance", "date"]).default("relevance"),
  cursor: z.string().max(500).optional(),
});

export interface SearchPage {
  hits: SearchHit[];
  total: number;
  nextCursor: string | null;
}

/** Live search of PubMed, PubMed Central and preprints via Europe PMC. */
export async function searchAction(input: unknown): Promise<Result<SearchPage>> {
  await requireReadyAccount();
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter something to search for." };
  const { query, cursor, ...filters } = parsed.data;
  const result = await searchLiterature(query, filters, { cursor });
  if (!result.ok) return { ok: false, error: result.reason };
  return { ok: true, value: { hits: result.hits, total: result.total, nextCursor: result.nextCursor } };
}

// ----------------------------------------------------------- resolve a paper

const paperRef = z.object({
  id: z.string().min(3).max(300),
  doi: z.string().max(200).optional(),
});

/**
 * Load a paper by id, from the database or, for a search result not stored
 * yet, from Europe PMC. Metadata always comes from the source, never from
 * the browser, because publication rows are shared by every user.
 */
async function resolvePublication(ref: z.infer<typeof paperRef>): Promise<Publication | null> {
  const [stored] = await publicationsByIds([ref.id]);
  if (stored) return stored;
  const pmid = ref.id.match(/^pmid-(\d+)$/)?.[1];
  const ppr = ref.id.match(/^ppr-(.+)$/)?.[1];
  const other = ref.id.match(/^epmc-([A-Z]+)-(.+)$/);
  const hit = pmid
    ? await lookupPaper({ pmid })
    : ppr
      ? await lookupPaper({ source: "PPR", extId: ppr })
      : other
        ? await lookupPaper({ source: other[1], extId: other[2] })
        : ref.doi
          ? await lookupPaper({ doi: ref.doi })
          : null;
  if (!hit || hit.publication.id !== ref.id) return null;
  await upsertPublications([hit.publication]);
  return hit.publication;
}

// ------------------------------------------------------------ library state

/** Save or unsave any paper, including one found by search and not yet explained. */
export async function toggleSaveAction(input: unknown, saved: boolean): Promise<Result<{ saved: boolean }>> {
  const account = await requireReadyAccount();
  const ref = paperRef.safeParse(input);
  if (!ref.success) return { ok: false, error: "Unknown paper." };
  const pub = await resolvePublication(ref.data);
  if (!pub) return { ok: false, error: "That paper could not be found at its source." };
  await setItemState(account.id, pub.id, {
    saved,
    ...(saved ? { readingStatus: "to_read" as const } : {}),
  });
  revalidatePath("/", "layout");
  return { ok: true, value: { saved } };
}

const libraryPatch = z.object({
  readingStatus: z.enum(["to_read", "reading", "read"]).nullable().optional(),
  notes: z.string().max(10_000).optional(),
});

/** Reading status and personal notes. */
export async function updateLibraryAction(
  publicationId: string,
  input: unknown,
): Promise<Result<{ libraryReady: boolean }>> {
  const account = await requireReadyAccount();
  const parsed = libraryPatch.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Notes are limited to 10,000 characters." };
  const [pub] = await publicationsByIds([String(publicationId)]);
  if (!pub) return { ok: false, error: "Unknown paper." };
  const result = await setItemState(account.id, pub.id, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true, value: result };
}

/** Record that the student opened a paper, for Continue Reading. */
export async function markViewedAction(publicationId: string): Promise<void> {
  const account = await requireReadyAccount();
  const [pub] = await publicationsByIds([String(publicationId)]);
  if (!pub) return;
  await setItemState(account.id, pub.id, { viewedAt: new Date().toISOString() });
}

// ------------------------------------------------------- AI explanations

/**
 * "Explain this paper": assess a paper found by search against the
 * student's topics and profile, exactly as monitoring would, and store it.
 */
export async function explainPaperAction(input: unknown): Promise<Result<{ id: string }>> {
  const account = await requireReadyAccount();
  const ref = paperRef.safeParse(input);
  if (!ref.success) return { ok: false, error: "Unknown paper." };

  const [existing] = await itemsByIds(account.id, [ref.data.id]);
  if (existing) return { ok: true, value: { id: existing.publication.id } };

  const used = await countDirectAssessments(account.id, new Date(Date.now() - 86_400_000));
  if (used >= DAILY_EXPLAIN_LIMIT && !account.isAdmin) {
    return {
      ok: false,
      error: `You've reached today's limit of ${DAILY_EXPLAIN_LIMIT} explained papers. Your saved papers are still in My Library.`,
    };
  }

  const pub = await resolvePublication(ref.data);
  if (!pub) return { ok: false, error: "That paper could not be found at its source." };
  const topics = (await listTopics(account.id)).filter((t) => t.active);
  if (!topics.length) return { ok: false, error: "Follow at least one research topic first." };

  const outcome = await evaluateNow(topics, pub, account.student);
  if (!outcome.ok) return { ok: false, error: "PaperPuffin couldn't explain this paper right now. Try again shortly." };
  await saveDirectAssessment(account.id, pub.id, topics[0].id, outcome.assessment);
  revalidatePath("/", "layout");
  return { ok: true, value: { id: pub.id } };
}

/** A study guide at one explanation level, generated once and then cached. */
export async function generateGuideAction(
  publicationId: string,
  level: unknown,
): Promise<Result<PaperGuide>> {
  const account = await requireReadyAccount();
  const parsedLevel = z.enum(["beginner", "intermediate", "advanced"]).safeParse(level);
  if (!parsedLevel.success) return { ok: false, error: "Unknown explanation level." };
  const [item] = await itemsByIds(account.id, [String(publicationId)]);
  if (!item) return { ok: false, error: "Ask PaperPuffin to explain this paper first." };
  const cached = item.assessment.guides?.[parsedLevel.data];
  if (cached) return { ok: true, value: cached };

  const topics = (await listTopics(account.id)).filter((t) => t.active);
  const result = await generateGuide(item.publication, parsedLevel.data, { topics, student: account.student });
  if (!result.ok) return { ok: false, error: result.reason };
  await saveGuide(account.id, item.publication.id, result.value);
  return { ok: true, value: result.value };
}
