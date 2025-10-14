'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Table from './Table';
import Badge from './Badge';
import { formatSaoPaulo } from '../lib/dates';
import type { FeedbackEntry } from '../lib/types';
import { getBadgeVariant, STATUS_LABEL } from '../lib/status';

const LOCAL_STORAGE_KEY = 'feedback-settings';

const DEFAULT_WHATSAPP_TEMPLATE =
  'Olá {{name}}, tudo bem? Aqui é a equipe da Kiwa. Vimos que sua compra de {{product}} está com status {{status}}. Conte conosco para qualquer dúvida!';

type FeedbackSettings = {
  emailServiceId: string;
  emailTemplateId: string;
  emailPublicKey: string;
  whatsappTemplate: string;
  whatsappMediaUrl: string;
};

type FeedbackDashboardProps = {
  entries: FeedbackEntry[];
};

type ActionFeedback = {
  type: 'success' | 'error';
  message: string;
};

type StatusFilter = 'all' | FeedbackEntry['status'];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'converted', label: 'Convertidos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'sent', label: 'E-mails enviados' },
  { key: 'refunded', label: 'Reembolsados' },
];

const ORIGIN_LABEL: Record<FeedbackEntry['origin'], string> = {
  sale: 'Venda aprovada',
  cart: 'Carrinho',
  mixed: 'Venda e carrinho',
};

const DEFAULT_SETTINGS: FeedbackSettings = {
  emailServiceId: '',
  emailTemplateId: '',
  emailPublicKey: '',
  whatsappTemplate: DEFAULT_WHATSAPP_TEMPLATE,
  whatsappMediaUrl: '',
};

const loadSettings = (): FeedbackSettings => {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored) as Partial<FeedbackSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    console.warn('[kiwify-hub] não foi possível carregar as configurações do feedback', error);
    return DEFAULT_SETTINGS;
  }
};

const saveSettings = (settings: FeedbackSettings) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('[kiwify-hub] não foi possível salvar as configurações do feedback', error);
  }
};

const applyTemplate = (template: string, entry: FeedbackEntry) => {
  const variant = getBadgeVariant(entry.status);
  const replacements: Record<string, string> = {
    name: entry.customer_name ?? '',
    email: entry.customer_email,
    phone: entry.customer_phone ?? '',
    product: entry.product_name ?? '',
    status: STATUS_LABEL[variant] ?? entry.status,
    purchase_date: entry.paid_at ? formatSaoPaulo(entry.paid_at) : '',
    last_update: entry.last_cart_activity ? formatSaoPaulo(entry.last_cart_activity) : '',
    checkout_url: entry.checkout_url ?? '',
  };

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => replacements[key] ?? '');
};

export default function FeedbackDashboard({ entries }: FeedbackDashboardProps) {
  const [settings, setSettings] = useState<FeedbackSettings>(DEFAULT_SETTINGS);
  const [isHydrated, setIsHydrated] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [emailSendingId, setEmailSendingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<Record<string, ActionFeedback | undefined>>({});

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      saveSettings(settings);
    }
  }, [isHydrated, settings]);

  const isEmailConfigured = Boolean(
    settings.emailServiceId && settings.emailTemplateId && settings.emailPublicKey,
  );

  const filteredEntries = useMemo(() => {
    if (statusFilter === 'all') {
      return entries;
    }
    return entries.filter((entry) => entry.status === statusFilter);
  }, [entries, statusFilter]);

  const handleSettingsChange = <K extends keyof FeedbackSettings>(key: K, value: FeedbackSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const handleSendEmail = useCallback(
    async (entry: FeedbackEntry) => {
      if (!entry.customer_email) {
        setActionFeedback((prev) => ({
          ...prev,
          [entry.id]: { type: 'error', message: 'E-mail do cliente não informado.' },
        }));
        return;
      }

      if (!isEmailConfigured) {
        setActionFeedback((prev) => ({
          ...prev,
          [entry.id]: { type: 'error', message: 'Configure o EmailJS antes de enviar.' },
        }));
        return;
      }

      if (emailSendingId) {
        return;
      }

      setEmailSendingId(entry.id);
      setActionFeedback((prev) => ({ ...prev, [entry.id]: undefined }));

      try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service_id: settings.emailServiceId,
            template_id: settings.emailTemplateId,
            user_id: settings.emailPublicKey,
            template_params: {
              to_email: entry.customer_email,
              to_name: entry.customer_name ?? entry.customer_email,
              customer_email: entry.customer_email,
              customer_name: entry.customer_name ?? '',
              customer_phone: entry.customer_phone ?? '',
              product_name: entry.product_name ?? '',
              status: entry.status,
              purchase_date: entry.paid_at ?? '',
              last_cart_activity: entry.last_cart_activity ?? '',
              checkout_url: entry.checkout_url ?? '',
            },
          }),
        });

        if (!response.ok) {
          const errorMessage = await response.text();
          throw new Error(errorMessage || 'Falha ao enviar e-mail.');
        }

        setActionFeedback((prev) => ({
          ...prev,
          [entry.id]: { type: 'success', message: 'E-mail enviado com sucesso.' },
        }));
      } catch (error) {
        setActionFeedback((prev) => ({
          ...prev,
          [entry.id]: {
            type: 'error',
            message: error instanceof Error ? error.message : 'Falha ao enviar e-mail.',
          },
        }));
      } finally {
        setEmailSendingId(null);
      }
    },
    [emailSendingId, isEmailConfigured, settings.emailPublicKey, settings.emailServiceId, settings.emailTemplateId],
  );

  const handleSendWhatsApp = useCallback(
    (entry: FeedbackEntry) => {
      if (!entry.customer_phone) {
        setActionFeedback((prev) => ({
          ...prev,
          [entry.id]: { type: 'error', message: 'Telefone do cliente não disponível.' },
        }));
        return;
      }

      const numericPhone = entry.customer_phone.replace(/\D+/g, '');
      if (!numericPhone) {
        setActionFeedback((prev) => ({
          ...prev,
          [entry.id]: { type: 'error', message: 'Telefone inválido para WhatsApp.' },
        }));
        return;
      }

      const message = applyTemplate(settings.whatsappTemplate, entry);
      const fullMessage = settings.whatsappMediaUrl
        ? `${message}\n${settings.whatsappMediaUrl}`
        : message;
      const encodedMessage = encodeURIComponent(fullMessage);
      const url = `https://api.whatsapp.com/send?phone=${numericPhone}&text=${encodedMessage}`;

      window.open(url, '_blank', 'noopener,noreferrer');

      setActionFeedback((prev) => ({
        ...prev,
        [entry.id]: { type: 'success', message: 'Mensagem aberta no WhatsApp.' },
      }));
    },
    [settings.whatsappMediaUrl, settings.whatsappTemplate],
  );

  const columns = useMemo(
    () => [
      {
        key: 'customer_email' as const,
        header: 'Cliente',
        render: (entry: FeedbackEntry) => (
          <div className="flex flex-col">
            <span className="font-medium text-white">{entry.customer_name || '—'}</span>
            <span className="text-xs text-slate-400">{entry.customer_email || '—'}</span>
            <span className="text-xs text-slate-500">{entry.customer_phone || '—'}</span>
          </div>
        ),
      },
      {
        key: 'product_name' as const,
        header: 'Produto',
        render: (entry: FeedbackEntry) => entry.product_name || '—',
      },
      {
        key: 'status' as const,
        header: 'Status',
        render: (entry: FeedbackEntry) => {
          const variant = getBadgeVariant(entry.status);
          return <Badge variant={variant}>{STATUS_LABEL[variant] ?? entry.status}</Badge>;
        },
      },
      {
        key: 'paid_at' as const,
        header: 'Data de compra',
        render: (entry: FeedbackEntry) => formatSaoPaulo(entry.paid_at),
      },
      {
        key: 'last_cart_activity' as const,
        header: 'Último carrinho',
        render: (entry: FeedbackEntry) => formatSaoPaulo(entry.last_cart_activity),
      },
      {
        key: 'origin' as const,
        header: 'Origem',
        render: (entry: FeedbackEntry) => ORIGIN_LABEL[entry.origin],
      },
      {
        key: 'checkout_url' as const,
        header: 'Ações',
        render: (entry: FeedbackEntry) => {
          const feedbackMessage = actionFeedback[entry.id];
          const isSending = emailSendingId === entry.id;

          return (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSendEmail(entry)}
                  disabled={isSending || !isEmailConfigured}
                  className="inline-flex items-center justify-center rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSending ? 'Enviando…' : 'Enviar e-mail'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(entry)}
                  className="inline-flex items-center justify-center rounded-lg border border-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10"
                >
                  Enviar WhatsApp
                </button>
              </div>
              {feedbackMessage ? (
                <span
                  className={
                    feedbackMessage.type === 'success'
                      ? 'text-xs font-medium text-emerald-300'
                      : 'text-xs font-medium text-rose-300'
                  }
                >
                  {feedbackMessage.message}
                </span>
              ) : null}
            </div>
          );
        },
      },
    ],
    [actionFeedback, emailSendingId, handleSendEmail, handleSendWhatsApp, isEmailConfigured],
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Integrações de feedback</h2>
          <button
            type="button"
            onClick={handleResetSettings}
            className="rounded-md border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Restaurar padrão
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="text-lg font-semibold">Configuração do EmailJS</h3>
            <p className="text-xs text-slate-400">
              Informe o serviço, template e chave pública utilizados na sua conta do EmailJS. Esses dados ficam
              salvos apenas neste navegador.
            </p>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
              Service ID
              <input
                type="text"
                value={settings.emailServiceId}
                onChange={(event) => handleSettingsChange('emailServiceId', event.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="ex: service_xpto"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
              Template ID
              <input
                type="text"
                value={settings.emailTemplateId}
                onChange={(event) => handleSettingsChange('emailTemplateId', event.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="ex: template_feedback"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
              Public Key
              <input
                type="text"
                value={settings.emailPublicKey}
                onChange={(event) => handleSettingsChange('emailPublicKey', event.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="ex: AbCdEf123456"
              />
            </label>
            <p className="text-xs text-slate-500">
              Os seguintes parâmetros são enviados automaticamente para o template: <code>to_email</code>,{' '}
              <code>to_name</code>, <code>customer_email</code>, <code>customer_name</code>, <code>customer_phone</code>,{' '}
              <code>product_name</code>, <code>status</code>, <code>purchase_date</code>, <code>last_cart_activity</code> e{' '}
              <code>checkout_url</code>.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="text-lg font-semibold">Mensagem de WhatsApp</h3>
            <p className="text-xs text-slate-400">
              Personalize o texto enviado quando o botão de WhatsApp for acionado. Utilize as variáveis{' '}
              <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>, <code>{'{{phone}}'}</code>, <code>{'{{product}}'}</code>,{' '}
              <code>{'{{status}}'}</code>, <code>{'{{purchase_date}}'}</code>, <code>{'{{last_update}}'}</code> e{' '}
              <code>{'{{checkout_url}}'}</code>.
            </p>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
              Template da mensagem
              <textarea
                value={settings.whatsappTemplate}
                onChange={(event) => handleSettingsChange('whatsappTemplate', event.target.value)}
                rows={6}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
              URL da mídia (opcional)
              <input
                type="text"
                value={settings.whatsappMediaUrl}
                onChange={(event) => handleSettingsChange('whatsappMediaUrl', event.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="https://…"
              />
            </label>
            <p className="text-xs text-slate-500">
              Caso informe uma mídia, o link será adicionado ao final da mensagem antes de abrir o WhatsApp Business.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map(({ key, label }) => {
            const isActive = statusFilter === key;
            const count = key === 'all' ? entries.length : entries.filter((entry) => entry.status === key).length;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                  isActive
                    ? 'border-brand bg-brand text-slate-950'
                    : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
                aria-pressed={isActive}
              >
                <span>{label}</span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-200">{count}</span>
              </button>
            );
          })}
        </div>

        <Table<FeedbackEntry>
          columns={columns}
          data={filteredEntries}
          getRowKey={(entry) => entry.id}
          emptyMessage="Nenhum cliente encontrado para o filtro selecionado."
        />
      </section>
    </div>
  );
}
