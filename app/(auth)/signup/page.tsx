import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { AuthCard } from "@/components/auth/AuthForm";

export const metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await currentUser()) redirect("/home");
  return (
    <AuthCard
      title="Create your account"
      subtitle="Free for students. PaperPuffin is in a small beta: invited students get access straight away, and others join a short waitlist."
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
