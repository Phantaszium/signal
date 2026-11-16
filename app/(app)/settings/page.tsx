import { SettingsForms } from "@/components/settings/SettingsForms";
import { requireReadyAccount } from "@/lib/auth/session";

export const metadata = { title: "Settings · Signal" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const account = await requireReadyAccount();
  const { notice } = await searchParams;
  return (
    <div className="px-6 py-7 lg:px-10 lg:py-9">
      <header className="max-w-3xl">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Settings</h1>
        <p className="mt-1 text-[13px] text-ink-muted">Signed in as {account.email}</p>
        {notice === "email-pending" && (
          <p role="status" className="mt-3 rounded border border-positive/25 bg-[#eef6f1] px-3 py-2 text-[13px] text-positive">
            That address is confirmed. Open the link sent to your other address to finish
            changing your email.
          </p>
        )}
      </header>
      <div className="mt-6 max-w-2xl">
        <SettingsForms email={account.email} emailDigest={account.emailDigest} />
      </div>
    </div>
  );
}
