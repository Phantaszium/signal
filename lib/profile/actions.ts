"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { updateAccount } from "@/lib/db/accounts";

const term = z.string().trim().min(1).max(120);
const list = z.array(term).max(40);

const profileSchema = z.object({
  program: z.string().trim().min(2, "Give your program a short name.").max(120),
  description: z.string().trim().max(2000),
  keywords: list.min(1, "Add at least one keyword."),
  genes: list,
  diseases: list,
  techniques: list,
  organizations: list,
});

export type SaveProfileResult = { ok: true } | { ok: false; error: string };

/** Save the signed-in user's research profile. Used by onboarding and /profile. */
export async function saveProfileAction(input: unknown): Promise<SaveProfileResult> {
  const account = await requireAccount();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await updateAccount(account.id, { researchProfile: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true };
}
