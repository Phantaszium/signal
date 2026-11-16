import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/profile/OnboardingForm";
import { requireAccount } from "@/lib/auth/session";

export const metadata = { title: "Set up your profile · Signal" };

export default async function OnboardingPage() {
  const account = await requireAccount();
  if (account.researchProfile) redirect("/");
  return (
    <div>
      <p className="eyebrow text-[10px] font-semibold text-accent">Step 2 of 2</p>
      <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        Tell Signal what you work on
      </h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
        Your email <strong className="text-ink">{account.email}</strong> is confirmed. Signal
        reads new papers, preprints and trial updates every night and uses this profile to
        decide which few are worth your time. You can change it whenever you like.
      </p>
      <div className="mt-6">
        <OnboardingForm />
      </div>
    </div>
  );
}
