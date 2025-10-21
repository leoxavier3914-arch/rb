import { type ZodType, z } from "zod";

const httpsUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), {
    message: "A URL do Supabase deve usar o protocolo https://.",
  });

const ensureSameSupabaseProject = (
  data: { SUPABASE_URL: string; NEXT_PUBLIC_SUPABASE_URL?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (!data.NEXT_PUBLIC_SUPABASE_URL) {
    return;
  }

  const adminUrl = new URL(data.SUPABASE_URL);
  const publicUrl = new URL(data.NEXT_PUBLIC_SUPABASE_URL);

  if (adminUrl.origin !== publicUrl.origin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "NEXT_PUBLIC_SUPABASE_URL deve apontar para o mesmo projeto do SUPABASE_URL.",
      path: ["NEXT_PUBLIC_SUPABASE_URL"],
    });
  }
};

const supabaseEnvBaseSchema = z.object({
  SUPABASE_URL: httpsUrlSchema,
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: httpsUrlSchema.optional(),
});

const supabaseEnvSchema = supabaseEnvBaseSchema.superRefine(ensureSameSupabaseProject);

const webhookEnvSchema = supabaseEnvBaseSchema
  .extend({
    KIWIFY_WEBHOOK_SECRET: z.string().min(1),
  })
  .superRefine(ensureSameSupabaseProject);

type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;
type WebhookEnv = z.infer<typeof webhookEnvSchema>;
const defaultKiwifyApiBaseUrl = "https://public-api.kiwify.com/";

const kiwifyApiBaseUrlSchema = httpsUrlSchema.refine((value) => {
  try {
    const { hostname } = new URL(value);
    return (
      hostname === "public-api.kiwify.com" ||
      hostname.endsWith(".kiwify.com") ||
      hostname.endsWith(".kiwify.com.br")
    );
  } catch {
    return false;
  }
}, {
  message:
    "A URL base da API da Kiwify deve apontar para um domínio kiwify.com ou kiwify.com.br.",
});

const kiwifyApiEnvSchema = z.object({
  KIWIFY_API_BASE_URL: kiwifyApiBaseUrlSchema.default(defaultKiwifyApiBaseUrl),
  KIWIFY_API_TOKEN: z.string().min(1),
  KIWIFY_API_ACCOUNT_ID: z.string().min(1),
});

type KiwifyApiEnv = z.infer<typeof kiwifyApiEnvSchema>;

type EnvHelper<T> = {
  get: () => T;
  has: () => boolean;
  maybe: () => T | null;
  reset: () => void;
};

const normalizeEnvValue = (value: string | undefined) => {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/^(["'])(.*)\1$/, "$2");
};

const createEnvHelper = <T>(
  schema: ZodType<T, z.ZodTypeDef, unknown>,
  buildRawEnv: () => unknown,
): EnvHelper<T> => {
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

const coalesceEnvValue = (...values: (string | undefined)[]) => {
  for (const value of values) {
    const normalized = normalizeEnvValue(value);
    if (normalized) {
      return normalized;
    }
  }

  return "";
};

const buildRawSupabaseEnv = () => ({
  SUPABASE_URL: coalesceEnvValue(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  SUPABASE_SERVICE_ROLE_KEY: coalesceEnvValue(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_ROLE,
  ),
  NEXT_PUBLIC_SUPABASE_URL: (() => {
    const normalized = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
    return normalized || undefined;
  })(),
});

const supabaseEnvHelper = createEnvHelper<SupabaseEnv>(
  supabaseEnvSchema,
  buildRawSupabaseEnv,
);

const buildRawWebhookEnv = () => ({
  ...(supabaseEnvHelper.maybe() ?? buildRawSupabaseEnv()),
  KIWIFY_WEBHOOK_SECRET: normalizeEnvValue(process.env.KIWIFY_WEBHOOK_SECRET),
});

const kiwifyWebhookEnvHelper = createEnvHelper<WebhookEnv>(
  webhookEnvSchema,
  buildRawWebhookEnv,
);

const buildRawKiwifyApiEnv = () => {
  const baseUrl = normalizeEnvValue(process.env.KIWIFY_API_BASE_URL);

  return {
    ...(baseUrl ? { KIWIFY_API_BASE_URL: baseUrl } : {}),
    KIWIFY_API_TOKEN: normalizeEnvValue(process.env.KIWIFY_API_TOKEN),
    KIWIFY_API_ACCOUNT_ID: normalizeEnvValue(process.env.KIWIFY_API_ACCOUNT_ID),
  };
};

const kiwifyApiEnvHelper = createEnvHelper<KiwifyApiEnv>(
  kiwifyApiEnvSchema,
  buildRawKiwifyApiEnv,
);

export const supabaseEnv = {
  get: () => supabaseEnvHelper.get(),
  has: () => supabaseEnvHelper.has(),
};

export const kiwifyWebhookEnv = {
  get: () => kiwifyWebhookEnvHelper.get(),
  has: () => kiwifyWebhookEnvHelper.has(),
};

export const kiwifyApiEnv = {
  get: () => kiwifyApiEnvHelper.get(),
  has: () => kiwifyApiEnvHelper.has(),
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

export function getKiwifyApiEnv(): KiwifyApiEnv {
  return kiwifyApiEnv.get();
}

export function hasKiwifyApiEnv() {
  return kiwifyApiEnv.has();
}

export function __resetEnvForTesting() {
  supabaseEnvHelper.reset();
  kiwifyWebhookEnvHelper.reset();
  kiwifyApiEnvHelper.reset();
}
