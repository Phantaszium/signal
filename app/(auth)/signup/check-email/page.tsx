import Link from "next/link";
import { ResendForm } from "@/components/auth/ResendForm";
import { AuthCard } from "@/components/auth/AuthForm";

export const metadata = { title: "Confirm your email · Signal" };

export default async function CheckEmailPage({ searchParams }: PageProps<"/signup/check-email">) {
  const { email } = await searchParams;
  const address = typeof email === "string" ? email : "";
  return (
    <AuthCard
      title="Check your inbox"
      subtitle={
        <>
          We sent a confirmation link to <strong className="text-ink">{address || "your email"}</strong>.
          Open it to link this address to your account, then set up your research profile.
        </>
      }
      footer={
        <Link href="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <p className="mb-3 text-[12px] text-ink-faint">Nothing after a few minutes? Check spam, or send it again.</p>
      <ResendForm email={address} />
    </AuthCard>
  );
}
