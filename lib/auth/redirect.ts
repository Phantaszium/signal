/**
 * Reduce a user-supplied `next` value to a same-site path. Parsing with URL
 * (rather than checking for a leading "/") also rejects tricks such as
 * "/\evil.com" that browsers treat as protocol-relative.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  try {
    const base = "http://signal.invalid";
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}` : "/";
  } catch {
    return "/";
  }
}

/** Set by /auth/confirm after a password-recovery link, required by /reset-password. */
export const RECOVERY_COOKIE = "signal_recovery";
