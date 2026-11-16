import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses row level security, so it must only ever run
 * on the server and only after the caller's identity has been checked.
 */
export function db(): SupabaseClient {
  client ??= createClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
