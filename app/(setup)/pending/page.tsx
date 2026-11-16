import Link from "next/link";
import { redirect } from "next/navigation";
import { currentTopics, requireAccount } from "@/lib/auth/session";

export const metadata = { title: "Waitlist · Signal" };

export default async function PendingPage() {
  const account = await requireAccount();
  if (account.approved) redirect("/");
  const hasTopic = (await currentTopics(account.id)).length > 0;
  return (
    <div className="max-w-xl">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">
        You&rsquo;re on the list
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        Signal is in a small pilot, and <strong className="text-ink">{account.email}</strong>{" "}
        hasn&rsquo;t been invited yet. You&rsquo;ll get access as soon as it&rsquo;s approved;
        there&rsquo;s nothing else you need to do.
      </p>
      {!hasTopic && (
        <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">
          In the meantime you can{" "}
          <Link href="/onboarding" className="font-medium text-accent hover:underline">
            set up your first monitored topic
          </Link>
          , so monitoring starts the moment you&rsquo;re in.
        </p>
      )}
    </div>
  );
}
