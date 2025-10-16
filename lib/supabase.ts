import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv, hasSupabaseEnv } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __supabaseAdmin: SupabaseClient | undefined;
}

export function getSupabaseAdmin() {
  const env = getSupabaseEnv();
  if (!globalThis.__supabaseAdmin) {
    globalThis.__supabaseAdmin = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
        },
      },
    );
  }

  return globalThis.__supabaseAdmin;
}

export function hasSupabaseConfig() {
  return hasSupabaseEnv();
}
