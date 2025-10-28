import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().min(1, "SUPABASE_URL is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  KIWIFY_CLIENT_ID: z.string().optional(),
  KIWIFY_CLIENT_SECRET: z.string().optional(),
  KIWIFY_ACCOUNT_ID: z.string().optional(),
  KIWIFY_API_BASE_URL: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(parsed.error.errors.map(error => error.message).join("\n"));
    }
    cachedEnv = parsed.data;
  }
  return cachedEnv;
}
