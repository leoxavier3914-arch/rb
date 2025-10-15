export const EMAIL_INTEGRATIONS_STORAGE_KEY = 'email-integrations-settings';

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  description: string;
  html: string;
};

export type EmailJsClientConfig = {
  serviceId: string;
  templateId: string;
  publicKey: string;
};

export type EmailFlowKey =
  | 'manual'
  | 'abandoned'
  | 'pending'
  | 'approved'
  | 'refunded'
  | 'converted';

export type EmailFlowSetting = {
  templateId: string;
  enabled: boolean;
};

export type EmailDeliverySettings = {
  manualEnabled: boolean;
  automaticEnabled: boolean;
  smartDelayEnabled: boolean;
};

export type EmailIntegrationSettings = {
  emailConfig: EmailJsClientConfig;
  fromEmail: string;
  templates: EmailTemplate[];
  selectedTemplateId: string;
  flowSettings: Record<EmailFlowKey, EmailFlowSetting>;
  delivery: EmailDeliverySettings;
};

export const DEFAULT_FROM_EMAIL = 'contato@kiwifyhub.com';

export const DEFAULT_EMAIL_TEMPLATES: ReadonlyArray<EmailTemplate> = [
  {
    id: 'remarketing',
    name: 'E-mail de remarketing',
    description: 'Carrinhos abandonados, enviado automaticamente como hoje.',
    subject: 'Seu carrinho está te esperando na Kiwify',
    html: `<h1>Volte para finalizar a compra ❤️</h1>\n<p>Notamos que você deixou itens no carrinho. Clique no botão abaixo para concluir.</p>\n<a href="{{{checkoutUrl}}}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;">Finalizar compra</a>`,
  },
  {
    id: 'feedback',
    name: 'E-mail de feedback',
    description: 'Disparado para vendas aprovadas pedindo a avaliação do cliente.',
    subject: 'Como foi a sua experiência com a Kiwify?',
    html: `<h1>Queremos ouvir você!</h1>\n<p>Conte como foi a sua experiência respondendo nosso rápido formulário.</p>\n<p>Obrigado por comprar com a gente 💜</p>`,
  },
];

export type EmailFlowConfig = {
  id: EmailFlowKey;
  label: string;
  description: string;
  defaultTemplateId: string;
  defaultEnabled: boolean;
};

export const EMAIL_FLOW_CONFIGS: ReadonlyArray<EmailFlowConfig> = [
  {
    id: 'manual',
    label: 'Envio manual',
    description: 'Usado nos envios individuais realizados pelo dashboard.',
    defaultTemplateId: 'feedback',
    defaultEnabled: true,
  },
  {
    id: 'abandoned',
    label: 'Carrinhos abandonados',
    description: 'Fluxo automático para clientes que abandonaram o checkout.',
    defaultTemplateId: 'remarketing',
    defaultEnabled: true,
  },
  {
    id: 'pending',
    label: 'Pagamentos pendentes',
    description: 'Envio automático para cobranças em análise ou aguardando confirmação.',
    defaultTemplateId: 'remarketing',
    defaultEnabled: true,
  },
  {
    id: 'approved',
    label: 'Pagamentos aprovados',
    description: 'Comunicações automáticas para vendas confirmadas.',
    defaultTemplateId: 'feedback',
    defaultEnabled: true,
  },
  {
    id: 'refunded',
    label: 'Reembolsos',
    description: 'Mensagens enviadas quando uma venda é reembolsada.',
    defaultTemplateId: 'feedback',
    defaultEnabled: true,
  },
  {
    id: 'converted',
    label: 'Convertidos',
    description: 'Fluxo para celebrar clientes que finalizaram a compra após um lembrete.',
    defaultTemplateId: 'feedback',
    defaultEnabled: true,
  },
];

const FLOW_KEY_SET = new Set<EmailFlowKey>(EMAIL_FLOW_CONFIGS.map((config) => config.id));

const isEmailTemplate = (value: unknown): value is EmailTemplate => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<EmailTemplate>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.subject === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.html === 'string'
  );
};

const ensureTemplateId = (templateId: string | undefined, templates: EmailTemplate[], fallbackId: string): string => {
  if (templateId && templates.some((template) => template.id === templateId)) {
    return templateId;
  }
  return fallbackId;
};

const ensureBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
};

const ensureDeliverySettings = (value: unknown): EmailDeliverySettings => {
  const fallback: EmailDeliverySettings = {
    manualEnabled: true,
    automaticEnabled: true,
    smartDelayEnabled: false,
  };

  if (!value || typeof value !== 'object') {
    return { ...fallback };
  }

  const candidate = value as Partial<EmailDeliverySettings>;

  return {
    manualEnabled: ensureBoolean(candidate?.manualEnabled, fallback.manualEnabled),
    automaticEnabled: ensureBoolean(candidate?.automaticEnabled, fallback.automaticEnabled),
    smartDelayEnabled: ensureBoolean(candidate?.smartDelayEnabled, fallback.smartDelayEnabled),
  };
};

const ensureEmailConfig = (
  _value: unknown,
  defaultEmailConfig: EmailJsClientConfig,
): EmailJsClientConfig => ({ ...defaultEmailConfig });

const cloneTemplates = (templates: ReadonlyArray<EmailTemplate>): EmailTemplate[] => templates.map((template) => ({ ...template }));

export const createDefaultFlowSettings = (templates: EmailTemplate[]): Record<EmailFlowKey, EmailFlowSetting> => {
  const fallbackTemplateId = templates[0]?.id ?? '';

  return EMAIL_FLOW_CONFIGS.reduce<Record<EmailFlowKey, EmailFlowSetting>>((acc, config) => {
    const templateId = ensureTemplateId(config.defaultTemplateId, templates, fallbackTemplateId);
    acc[config.id] = {
      templateId,
      enabled: config.defaultEnabled,
    };
    return acc;
  }, {} as Record<EmailFlowKey, EmailFlowSetting>);
};

export const normalizeFlowSettings = (
  value: unknown,
  templates: EmailTemplate[],
  fallback: Record<EmailFlowKey, EmailFlowSetting>,
): Record<EmailFlowKey, EmailFlowSetting> => {
  const fallbackTemplateId = templates[0]?.id ?? '';

  if (!value || typeof value !== 'object') {
    return { ...fallback };
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const normalized = { ...fallback };

  for (const [key, rawSetting] of entries) {
    if (!FLOW_KEY_SET.has(key as EmailFlowKey)) {
      continue;
    }

    const candidate = rawSetting as Partial<EmailFlowSetting> | undefined;
    const existing = fallback[key as EmailFlowKey];
    normalized[key as EmailFlowKey] = {
      templateId: ensureTemplateId(candidate?.templateId, templates, existing?.templateId ?? fallbackTemplateId),
      enabled: ensureBoolean(candidate?.enabled, existing?.enabled ?? true),
    };
  }

  return normalized;
};

export const normalizeEmailIntegrationSettings = (
  value: unknown,
  defaultEmailConfig: EmailJsClientConfig,
): EmailIntegrationSettings => {
  const baseTemplates = cloneTemplates(DEFAULT_EMAIL_TEMPLATES);
  const base: EmailIntegrationSettings = {
    emailConfig: { ...defaultEmailConfig },
    fromEmail: DEFAULT_FROM_EMAIL,
    templates: baseTemplates,
    selectedTemplateId: baseTemplates[0]?.id ?? '',
    flowSettings: createDefaultFlowSettings(baseTemplates),
    delivery: {
      manualEnabled: true,
      automaticEnabled: true,
      smartDelayEnabled: false,
    },
  };

  if (!value || typeof value !== 'object') {
    return base;
  }

  const candidate = value as Partial<EmailIntegrationSettings>;

  const storedTemplates = Array.isArray(candidate.templates)
    ? candidate.templates.filter(isEmailTemplate).map((template) => ({ ...template }))
    : [];
  const templates = storedTemplates.length > 0 ? storedTemplates : base.templates;
  const fallbackTemplateId = templates[0]?.id ?? base.templates[0]?.id ?? '';

  const selectedTemplateId =
    typeof candidate.selectedTemplateId === 'string' &&
    templates.some((template) => template.id === candidate.selectedTemplateId)
      ? candidate.selectedTemplateId
      : fallbackTemplateId;

  const fromEmail =
    typeof candidate.fromEmail === 'string' && candidate.fromEmail.trim().length > 0
      ? candidate.fromEmail
      : base.fromEmail;

  const emailConfig = ensureEmailConfig(candidate.emailConfig, defaultEmailConfig);

  const defaultFlowSettings = createDefaultFlowSettings(templates);
  const flowSettings = normalizeFlowSettings(candidate.flowSettings, templates, defaultFlowSettings);

  const delivery = ensureDeliverySettings((candidate as Partial<EmailIntegrationSettings>)?.delivery);

  return {
    emailConfig,
    fromEmail,
    templates,
    selectedTemplateId,
    flowSettings,
    delivery,
  };
};

export const syncFlowSettingsWithTemplates = (
  flowSettings: Record<EmailFlowKey, EmailFlowSetting>,
  templates: EmailTemplate[],
): Record<EmailFlowKey, EmailFlowSetting> => {
  const defaults = createDefaultFlowSettings(templates);
  return normalizeFlowSettings(flowSettings, templates, defaults);
};
