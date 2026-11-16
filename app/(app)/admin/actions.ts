"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/(auth)/actions";
import { requireAdmin } from "@/lib/auth/session";
import { inviteEmail, removeInvite, updateAccount } from "@/lib/db/accounts";

export async function inviteAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  await inviteEmail(parsed.data);
  revalidatePath("/admin");
  return {
    message: `${parsed.data} is invited. If they already have an account it is approved now; otherwise it will be when they sign up.`,
  };
}

export async function removeInviteAction(email: string): Promise<void> {
  await requireAdmin();
  await removeInvite(z.string().parse(email));
  revalidatePath("/admin");
}

export async function setApprovedAction(userId: string, approved: boolean): Promise<void> {
  await requireAdmin();
  await updateAccount(z.string().uuid().parse(userId), { approved: Boolean(approved) });
  revalidatePath("/admin");
}
