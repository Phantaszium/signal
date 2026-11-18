import { redirect } from "next/navigation";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { currentTopics, requireAccount } from "@/lib/auth/session";

export const metadata = { title: "Set up your research profile" };

export default async function OnboardingPage() {
  const account = await requireAccount();
  if ((await currentTopics(account.id)).length) redirect("/home");
  return <Onboarding email={account.email} />;
}
