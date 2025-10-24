import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

if (!parsed.success) {
  throw new Error(`Variáveis do Supabase ausentes: ${parsed.error.message}`);
}

export const supabaseAdmin = createClient(
  parsed.data.SUPABASE_URL,
  parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "kiwify-dashboard/1.0.0",
      },
    },
  },
);
