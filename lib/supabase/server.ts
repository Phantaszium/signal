import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Supabase client bound to the visitor's auth cookies. Used only for Auth
 * calls (sign in, sign up, session checks); table access goes through the
 * admin client after the session has been verified.
 */
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabasePublishableKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // proxy refreshes the session on the next request instead.
        }
      },
    },
  });
}
