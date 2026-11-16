import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthCard } from "@/components/auth/AuthForm";

export const metadata = { title: "Sign in · Signal" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await currentUser()) redirect("/");
  const { next, error } = await searchParams;
  return (
    <AuthCard
      title="Sign in"
      subtitle="Know what changed in your field, why it matters, and what to do next."
      footer={
        <>
          New to Signal?{" "}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm
        next={typeof next === "string" ? next : "/"}
        linkError={error === "link"}
      />
    </AuthCard>
  );
}
