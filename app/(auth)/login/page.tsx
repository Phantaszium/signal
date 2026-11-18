import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthCard } from "@/components/auth/AuthForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await currentUser()) redirect("/home");
  const { next, error } = await searchParams;
  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back to your research companion."
      footer={
        <>
          New to PaperPuffin?{" "}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm
        next={typeof next === "string" ? next : "/home"}
        linkError={error === "link"}
      />
    </AuthCard>
  );
}
