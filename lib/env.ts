import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  KIWIFY_WEBHOOK_TOKEN: z.string().min(1),
});

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

const normalizeToken = (value: string | undefined) => {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/^(["'])(.*)\1$/, "$2");
};

const buildRawEnv = () => ({
  SUPABASE_URL:
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE ??
    "",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  KIWIFY_WEBHOOK_TOKEN: normalizeToken(process.env.KIWIFY_WEBHOOK_TOKEN),
});

export function maybeEnv(): Env | null {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(buildRawEnv());

  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Variáveis de ambiente incompletas", parsed.error.flatten().fieldErrors);
    }
    return null;
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getEnv(): Env {
  const env = maybeEnv();

  if (!env) {
    throw new Error("Configure todas as variáveis de ambiente obrigatórias.");
  }

  return env;
}

export function __resetEnvForTesting() {
  cachedEnv = null;
}
