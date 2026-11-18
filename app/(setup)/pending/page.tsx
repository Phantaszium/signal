import Link from "next/link";
import { redirect } from "next/navigation";
import { Puffin } from "@/components/brand/Puffin";
import { currentTopics, requireAccount } from "@/lib/auth/session";

export const metadata = { title: "You're on the list" };

export default async function PendingPage() {
  const account = await requireAccount();
  if (account.approved) redirect("/home");
  const hasTopic = (await currentTopics(account.id)).length > 0;
  return (
    <div className="mx-auto max-w-xl text-center">
      <Puffin size={72} mood="sleepy" className="mx-auto" />
      <h1 className="mt-4 font-display text-[28px] font-semibold text-ink">You&rsquo;re on the list</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
        PaperPuffin is in a small beta, and <strong className="text-ink">{account.email}</strong> hasn&rsquo;t been
        invited yet. You&rsquo;ll get access as soon as it&rsquo;s approved; there&rsquo;s nothing else you need to do.
      </p>
      {!hasTopic && (
        <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
          In the meantime you can{" "}
          <Link href="/onboarding" className="font-semibold text-accent hover:underline">
            set up your research profile
          </Link>
          , so PaperPuffin can start finding papers the moment you&rsquo;re in.
        </p>
      )}
    </div>
  );
}
