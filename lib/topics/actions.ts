"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { ALL_SOURCES, createTopic, deleteTopic, listTopics, updateTopic } from "@/lib/db/topics";
import type { SourceKey } from "@/lib/types";

const term = z.string().trim().min(1).max(120);
const list = z.array(term).max(40);

/** More than this and a user's checks get slow and costly; ask them to merge topics. */
const MAX_TOPICS = 8;

const topicSchema = z.object({
  profile: z.object({
    program: z.string().trim().min(2, "Give the topic a short name.").max(120),
    description: z.string().trim().max(2000),
    keywords: list.min(1, "Add at least one keyword."),
    synonyms: list,
    genes: list,
    organisms: list,
    diseases: list,
    techniques: list,
    organizations: list,
    exclusions: list,
  }),
  sensitivity: z.enum(["broad", "balanced", "strict"]),
  sources: z
    .array(z.enum(ALL_SOURCES as [SourceKey, ...SourceKey[]]))
    .min(1, "Choose at least one source to search."),
  active: z.boolean(),
});

export type SaveTopicResult = { ok: true; id: string } | { ok: false; error: string };

/** Create (id null) or update one of the signed-in user's topics. Used by onboarding and /topics. */
export async function saveTopicAction(id: string | null, input: unknown): Promise<SaveTopicResult> {
  const account = await requireAccount();
  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  if (id) {
    const valid = z.string().uuid().safeParse(id);
    if (!valid.success) return { ok: false, error: "That topic no longer exists." };
    await updateTopic(account.id, valid.data, parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, id: valid.data };
  }

  const existing = await listTopics(account.id);
  if (existing.length >= MAX_TOPICS) {
    return { ok: false, error: `You can follow up to ${MAX_TOPICS} topics. Remove or merge one first.` };
  }
  const created = await createTopic(account.id, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true, id: created };
}

export async function deleteTopicAction(id: string): Promise<SaveTopicResult> {
  const account = await requireAccount();
  const valid = z.string().uuid().safeParse(id);
  if (!valid.success) return { ok: false, error: "That topic no longer exists." };
  const topics = await listTopics(account.id);
  if (topics.length <= 1) {
    return { ok: false, error: "PaperPuffin needs at least one topic. Edit this one instead, or add another first." };
  }
  await deleteTopic(account.id, valid.data);
  revalidatePath("/", "layout");
  return { ok: true, id: valid.data };
}
