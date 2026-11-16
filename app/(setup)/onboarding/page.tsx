import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/topics/OnboardingForm";
import { currentTopics, requireAccount } from "@/lib/auth/session";

export const metadata = { title: "Set up your profile · Signal" };

export default async function OnboardingPage() {
  const account = await requireAccount();
  if ((await currentTopics(account.id)).length) redirect("/");
  return (
    <div>
      <p className="eyebrow text-[10px] font-semibold text-accent">Step 2 of 2</p>
      <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        What should Signal watch for you?
      </h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
        Your email <strong className="text-ink">{account.email}</strong> is confirmed. Describe
        one research question to monitor. Signal checks new papers, preprints and trial updates
        against it every morning and tells you when something meaningful changes, starting with
        the last 30 days. You can add more topics later.
      </p>
      <div className="mt-6">
        <OnboardingForm />
      </div>
    </div>
  );
}
