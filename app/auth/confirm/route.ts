import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { RECOVERY_COOKIE, safeNextPath } from "@/lib/auth/redirect";
import { createAuthClient } from "@/lib/supabase/server";

/**
 * Landing point for every emailed auth link: signup confirmation, password
 * reset and email change. Handles both link styles Supabase can send:
 * `token_hash` (works in any browser) and PKCE `code` (same browser only).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  const supabase = await createAuthClient();

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const target = url.clone();
  target.search = "";

  // With secure email change, the first of the two links only acknowledges
  // one address and carries a message instead of a token.
  const message = url.searchParams.get("message");
  if (!tokenHash && !code && message && !url.searchParams.get("error")) {
    target.pathname = "/settings";
    target.searchParams.set("notice", "email-pending");
    return NextResponse.redirect(target);
  }

  let ok = false;
  let recovery = type === "recovery";
  if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
    // PKCE recovery links carry no type; the reset flow asks for this page.
    recovery = next === "/reset-password";
  }

  if (!ok) {
    target.pathname = "/login";
    target.searchParams.set("error", "link");
    return NextResponse.redirect(target);
  }

  target.pathname = recovery ? "/reset-password" : next;
  const response = NextResponse.redirect(target);
  if (recovery) {
    response.cookies.set(RECOVERY_COOKIE, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
    });
  }
  return response;
}
