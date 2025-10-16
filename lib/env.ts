import { z } from "zod";

const supabaseEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
});

const webhookEnvSchema = supabaseEnvSchema.extend({
  KIWIFY_WEBHOOK_SECRET: z.string().min(1),
});

type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;
type WebhookEnv = z.infer<typeof webhookEnvSchema>;

let cachedSupabaseEnv: SupabaseEnv | null = null;
let cachedWebhookEnv: WebhookEnv | null = null;

const normalizeToken = (value: string | undefined) => {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/^(["'])(.*)\1$/, "$2");
};

const buildRawSupabaseEnv = () => ({
  SUPABASE_URL:
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE ??
    "",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
});

const maybeSupabaseEnv = (): SupabaseEnv | null => {
  if (cachedSupabaseEnv) {
    return cachedSupabaseEnv;
  }

  const parsed = supabaseEnvSchema.safeParse(buildRawSupabaseEnv());

  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Variáveis de ambiente incompletas", parsed.error.flatten().fieldErrors);
    }
    return null;
  }

  cachedSupabaseEnv = parsed.data;
  return cachedSupabaseEnv;
};

const maybeWebhookEnv = (): WebhookEnv | null => {
  if (cachedWebhookEnv) {
    return cachedWebhookEnv;
  }

  const baseEnv = maybeSupabaseEnv();
  if (!baseEnv) {
    return null;
  }

  const parsed = webhookEnvSchema.safeParse({
    ...baseEnv,
    KIWIFY_WEBHOOK_SECRET: normalizeToken(process.env.KIWIFY_WEBHOOK_SECRET),
  });

  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Variáveis de ambiente incompletas", parsed.error.flatten().fieldErrors);
    }
    return null;
  }

  cachedWebhookEnv = parsed.data;
  return cachedWebhookEnv;
};

export function hasSupabaseEnv() {
  return maybeSupabaseEnv() !== null;
}

export function getSupabaseEnv(): SupabaseEnv {
  const env = maybeSupabaseEnv();

  if (!env) {
    throw new Error("Configure todas as variáveis de ambiente obrigatórias.");
  }

  return env;
}

export function getWebhookEnv(): WebhookEnv {
  const env = maybeWebhookEnv();

  if (!env) {
    throw new Error("Configure todas as variáveis de ambiente obrigatórias.");
  }

  return env;
}

export function __resetEnvForTesting() {
  cachedSupabaseEnv = null;
  cachedWebhookEnv = null;
}
