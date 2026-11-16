import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RECOVERY_COOKIE } from "@/lib/auth/redirect";
import { currentUser } from "@/lib/auth/session";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { AuthCard } from "@/components/auth/AuthForm";

export const metadata = { title: "Choose a new password · Signal" };

/** Reached from the emailed reset link, which signs the user in first. */
export default async function ResetPasswordPage() {
  const recovering = (await cookies()).has(RECOVERY_COOKIE);
  if (!recovering || !(await currentUser())) redirect("/login?error=link");
  return (
    <AuthCard title="Choose a new password">
      <ResetPasswordForm />
    </AuthCard>
  );
}
