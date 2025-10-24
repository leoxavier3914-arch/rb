import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

type SupabaseClientType = SupabaseClient<any, "public", any>;

const missingConfigMessage = parsed.success
  ? null
  : `Variáveis do Supabase ausentes: ${parsed.error.message}`;

const createErrorProxy = (): SupabaseClientType =>
  new Proxy(
    {},
    {
      get() {
        throw new Error(missingConfigMessage ?? "Supabase não configurado");
      },
    },
  ) as SupabaseClientType;

export const supabaseAdmin: SupabaseClientType = parsed.success
  ? createClient<any, "public", any>(parsed.data.SUPABASE_URL, parsed.data.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          "X-Client-Info": "kiwify-dashboard/1.0.0",
        },
      },
    })
  : createErrorProxy();

export const getSupabaseAdmin = () => {
  if (!parsed.success) {
    throw new Error(missingConfigMessage ?? "Supabase não configurado");
  }
  return supabaseAdmin;
};

export const hasSupabaseConfig = () => parsed.success;
