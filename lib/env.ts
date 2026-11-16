import "server-only";

/**
 * Server-side environment, read in one place.
 *
 * Supabase variable names differ between the dashboard ("publishable" /
 * "secret" keys) and the Vercel Marketplace integration (anon / service role),
 * so both spellings are accepted.
 */

function required(name: string, ...fallbacks: string[]): string {
  for (const key of [name, ...fallbacks]) {
    const value = process.env[key];
    if (value) return value;
  }
  throw new Error(`Missing environment variable ${name}`);
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"),
  supabasePublishableKey: () =>
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
  /** Public origin used in emailed links, e.g. https://signal.example.com */
  siteUrl: () =>
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
  cronSecret: () => required("CRON_SECRET"),
  /** Comma-separated emails allowed into /admin. Always approved. */
  adminEmails: (): string[] =>
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  model: () => process.env.SIGNAL_MODEL || "claude-opus-5-5",
  resendApiKey: () => process.env.RESEND_API_KEY,
  emailFrom: () => process.env.EMAIL_FROM ?? "Signal <briefing@resend.dev>",
};
