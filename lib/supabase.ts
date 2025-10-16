import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __supabaseAdmin: SupabaseClient | undefined;
}

export function getSupabaseAdmin() {
  const env = supabaseEnv.get();
  if (!globalThis.__supabaseAdmin) {
    const originalFetch = globalThis.fetch.bind(globalThis);
    const fetchWithNoStore: typeof fetch = (input, init) =>
      originalFetch(input, {
        ...(init ?? {}),
        cache: "no-store",
      });

    globalThis.__supabaseAdmin = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
        },
        global: {
          fetch: fetchWithNoStore,
        },
      },
    );
  }

  return globalThis.__supabaseAdmin;
}

export function hasSupabaseConfig() {
  return supabaseEnv.has();
}
