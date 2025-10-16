import { type ZodType, z } from "zod";

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

type EnvHelper<T> = {
  get: () => T;
  has: () => boolean;
  maybe: () => T | null;
  reset: () => void;
};

const normalizeToken = (value: string | undefined) => {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/^(["'])(.*)\1$/, "$2");
};

const createEnvHelper = <T>(schema: ZodType<T>, buildRawEnv: () => unknown): EnvHelper<T> => {
  let cache: T | undefined;

  const maybe = (): T | null => {
    if (cache) {
      return cache;
    }

    const parsed = schema.safeParse(buildRawEnv());

    if (!parsed.success) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Variáveis de ambiente incompletas", parsed.error.flatten().fieldErrors);
      }
      return null;
    }

    cache = parsed.data;
    return cache;
  };

  return {
    get: () => {
      const env = maybe();

      if (!env) {
        throw new Error("Configure todas as variáveis de ambiente obrigatórias.");
      }

      return env;
    },
    has: () => maybe() !== null,
    maybe,
    reset: () => {
      cache = undefined;
    },
  };
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

const supabaseEnvHelper = createEnvHelper(supabaseEnvSchema, buildRawSupabaseEnv);

const buildRawWebhookEnv = () => ({
  ...(supabaseEnvHelper.maybe() ?? buildRawSupabaseEnv()),
  KIWIFY_WEBHOOK_SECRET: normalizeToken(process.env.KIWIFY_WEBHOOK_SECRET),
});

const kiwifyWebhookEnvHelper = createEnvHelper(webhookEnvSchema, buildRawWebhookEnv);

export const supabaseEnv = {
  get: () => supabaseEnvHelper.get(),
  has: () => supabaseEnvHelper.has(),
};

export const kiwifyWebhookEnv = {
  get: () => kiwifyWebhookEnvHelper.get(),
  has: () => kiwifyWebhookEnvHelper.has(),
};

export function getSupabaseEnv(): SupabaseEnv {
  return supabaseEnv.get();
}

export function hasSupabaseEnv() {
  return supabaseEnv.has();
}

export function getKiwifyWebhookEnv(): WebhookEnv {
  return kiwifyWebhookEnv.get();
}

export function __resetEnvForTesting() {
  supabaseEnvHelper.reset();
  kiwifyWebhookEnvHelper.reset();
}
