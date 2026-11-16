import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { AuthCard } from "@/components/auth/AuthForm";

export const metadata = { title: "Create account · Signal" };

export default async function SignUpPage() {
  if (await currentUser()) redirect("/");
  return (
    <AuthCard
      title="Create your account"
      subtitle="Signal is in a small pilot. Anyone can register; invited researchers get access straight away, and others join a short waitlist."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
