import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

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
  try {
    getSupabaseEnv();
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Supabase configuration missing", error);
    }
    return false;
  }
}
