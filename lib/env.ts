import { z } from 'zod';

const envSchema = z.object({
  ALLOWED_ORIGINS: z.string().optional(),
  BASIC_AUTH_USER: z.string().optional(),
  BASIC_AUTH_PASS: z.string().optional(),
  SYNC_BUDGET_MS: z.string().transform((value) => Number.parseInt(value, 10)).optional(),
  KIWIFY_API_BASE_URL: z.string().optional(),
  KIWIFY_CLIENT_ID: z.string().optional(),
  KIWIFY_CLIENT_SECRET: z.string().optional(),
  KIWIFY_ACCOUNT_ID: z.string().optional(),
  KIWIFY_WEBHOOK_SECRET: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DB_UPSERT_BATCH: z.string().transform((value) => Number.parseInt(value, 10)).optional(),
  KFY_PAGE_SIZE: z.string().transform((value) => Number.parseInt(value, 10)).optional(),
  MAX_WRITE_MS: z.string().transform((value) => Number.parseInt(value, 10)).optional()
});

export type AppEnv = z.infer<typeof envSchema>;

let cache: AppEnv | null = null;

export function loadEnv(): AppEnv {
  if (cache) {
    return cache;
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Env inválido: ${parsed.error.message}`);
  }
  cache = parsed.data;
  return cache;
}

export function getAllowedOrigins(): string[] {
  const env = loadEnv();
  if (!env.ALLOWED_ORIGINS) {
    return [];
  }
  return env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
}
