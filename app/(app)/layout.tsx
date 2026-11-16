import { AppShell } from "@/components/layout/AppShell";
import { requireReadyAccount } from "@/lib/auth/session";
import { loadAppState } from "@/lib/db/app-state";
import { SignalProvider } from "@/lib/store/SignalProvider";

/** Every page in this group needs an approved account with a research profile. */
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const account = await requireReadyAccount();
  const initial = await loadAppState(account);
  return (
    <SignalProvider initial={initial}>
      <AppShell>{children}</AppShell>
    </SignalProvider>
  );
}
