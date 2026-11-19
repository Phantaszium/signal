"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { suggestSearchTerms, type SuggestedTerms } from "@/lib/ai/student";
import { requireAccount } from "@/lib/auth/session";
import { updateAccount } from "@/lib/db/accounts";
import { createTopic, listTopics } from "@/lib/db/topics";
import { lookupPaper } from "@/lib/ingestion/europepmc";
import { parsePaperIdentifier } from "@/lib/profile/student";
import type { FoundationalPaper, StudentProfile } from "@/lib/types";

const paperSchema = z.object({
  input: z.string().trim().min(1).max(300),
  title: z.string().max(500).optional(),
  authors: z.string().max(500).optional(),
  journal: z.string().max(300).optional(),
  year: z.string().max(10).optional(),
  url: z.string().url().max(500).optional(),
  doi: z.string().max(200).optional(),
  pmid: z.string().max(20).optional(),
  resolved: z.boolean(),
});

const studentSchema = z.object({
  academicLevel: z.enum(["undergraduate", "masters", "phd", "postdoc", "research_staff", "other"]).nullable(),
  field: z.string().trim().max(120),
  researchQuestion: z.string().trim().max(600),
  projectDescription: z.string().trim().max(4000),
  foundationalPapers: z.array(paperSchema).max(10),
  explanationLevel: z.enum(["beginner", "intermediate", "advanced"]).nullable(),
});

const term = z.string().trim().min(1).max(120);
const terms = z.array(term).max(40);

const onboardingSchema = z.object({
  student: studentSchema,
  topic: z.object({
    program: z.string().trim().min(2, "Give your topic a short name.").max(120),
    description: z.string().trim().max(2000),
    keywords: terms.min(1, "Add at least one search term so PaperPuffin can look for papers."),
    synonyms: terms,
    genes: terms,
    organisms: terms,
    diseases: terms,
    techniques: terms,
  }),
  digestFrequency: z.enum(["daily", "weekly", "off"]),
});

type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Finish onboarding: store the research profile, create the first topic and
 * set the briefing frequency. Only the topic's name and one search term are
 * required; everything else can be filled in later from My Research.
 */
export async function completeOnboardingAction(input: unknown): Promise<Result> {
  const account = await requireAccount();
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { student, topic, digestFrequency } = parsed.data;

  await updateAccount(account.id, {
    student: { ...student, updatedAt: new Date().toISOString() },
    digestFrequency,
  });
  if (!(await listTopics(account.id)).length) {
    await createTopic(account.id, {
      profile: { ...topic, organizations: [], exclusions: [] },
      sensitivity: "balanced",
      // Clinical-trial registrations are opt-in: most student projects are
      // better served by papers and preprints.
      sources: ["pubmed", "biorxiv", "medrxiv", "europepmc"],
      active: true,
    });
  }
  revalidatePath("/", "layout");
  return { ok: true, value: undefined };
}

/** Save edits to the research profile from My Research. */
export async function saveStudentProfileAction(input: unknown): Promise<Result> {
  const account = await requireAccount();
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const student: StudentProfile = { ...parsed.data, updatedAt: new Date().toISOString() };
  await updateAccount(account.id, { student });
  revalidatePath("/", "layout");
  return { ok: true, value: undefined };
}

/** Ask the AI for search terms from a plain-language description. */
export async function suggestTermsAction(input: {
  field: string;
  researchQuestion: string;
  projectDescription: string;
}): Promise<Result<SuggestedTerms>> {
  const account = await requireAccount();
  // AI calls cost money, so they wait for the beta gate like everything else.
  if (!account.approved) {
    return { ok: false, error: "AI suggestions unlock once your beta access is approved." };
  }
  const parsed = z
    .object({
      field: z.string().max(120),
      researchQuestion: z.string().max(600),
      projectDescription: z.string().max(4000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "That description is too long." };
  const result = await suggestSearchTerms(parsed.data);
  return result.ok ? { ok: true, value: result.value } : { ok: false, error: result.reason };
}

/**
 * Resolve a pasted DOI, PMID or link to real metadata via Europe PMC. Papers
 * that can't be found are kept as entered, marked unresolved, and never
 * given an invented title.
 */
export async function resolvePaperAction(input: string): Promise<Result<FoundationalPaper>> {
  await requireAccount();
  const text = String(input ?? "").trim().slice(0, 300);
  const id = parsePaperIdentifier(text);
  if (!id) return { ok: false, error: "That doesn't look like a DOI, PMID or PubMed link." };
  const hit = await lookupPaper(id);
  if (!hit) {
    return {
      ok: true,
      value: { input: text, resolved: false, ...("doi" in id ? { doi: id.doi } : { pmid: id.pmid }) },
    };
  }
  const p = hit.publication;
  return {
    ok: true,
    value: {
      input: text,
      title: p.title,
      authors: p.authors.slice(0, 3).join(", ") + (p.authors.length > 3 ? " et al." : ""),
      journal: p.source,
      year: p.publishedAt.slice(0, 4),
      url: p.url,
      doi: p.doi,
      pmid: p.id.startsWith("pmid-") ? p.id.slice(5) : undefined,
      resolved: true,
    },
  };
}
