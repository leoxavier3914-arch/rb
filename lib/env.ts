import { z } from 'zod';

const envSchema = z.object({
  KIWIFY_API_BASE_URL: z.string().optional(),
  KIWIFY_CLIENT_ID: z.string().optional(),
  KIWIFY_CLIENT_SECRET: z.string().optional(),
  KIWIFY_ACCOUNT_ID: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  KFY_PAGE_SIZE: z
    .string()
    .transform(value => Number.parseInt(value, 10))
    .optional()
});

export type AppEnv = z.infer<typeof envSchema>;

let cache: AppEnv | null = null;

export function loadEnv(): AppEnv {
  if (cache) {
    return cache;
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Variáveis de ambiente inválidas: ${parsed.error.message}`);
  }
  cache = parsed.data;
  return cache;
}
