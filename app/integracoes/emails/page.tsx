"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import IntegrationGuideLink from '../../../components/IntegrationGuideLink';
import IntegrationSection from '../../../components/IntegrationSection';
import {
  EMAIL_FLOW_CONFIGS,
  EMAIL_INTEGRATIONS_STORAGE_KEY,
  EmailIntegrationSettings,
  EmailTemplate,
  normalizeEmailIntegrationSettings,
  syncFlowSettingsWithTemplates,
} from '../../../lib/emailIntegrations';

const toggles = [
  {
    id: 'manual-email-delivery',
    label: 'Envio manual',
    description: 'Habilite para disparar feedbacks de forma individual diretamente pelo dashboard.',
    defaultChecked: true,
  },
  {
    id: 'automatic-email-delivery',
    label: 'Envio automático',
    description: 'Aciona envios automáticos para clientes conforme as regras do fluxo configurado.',
    defaultChecked: true,
  },
  {
    id: 'smart-delay-email',
    label: 'Delay inteligente',
    description: 'Distribui os envios ao longo do dia para evitar bloqueios de provedores.',
    defaultChecked: false,
  },
];

export default function EmailIntegrationsPage() {
  const defaultEmailConfig = useMemo(
    () => ({
      serviceId: process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID ?? '',
      templateId: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ?? '',
      publicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY ?? '',
    }),
    [],
  );

  const defaultSettings = useMemo<EmailIntegrationSettings>(
    () => normalizeEmailIntegrationSettings(undefined, defaultEmailConfig),
    [defaultEmailConfig],
  );

  const [settings, setSettings] = useState<EmailIntegrationSettings>(defaultSettings);
  const { templates, selectedTemplateId, fromEmail, emailConfig, flowSettings } = settings;
  
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const stored = window.localStorage.getItem(EMAIL_INTEGRATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const normalized = normalizeEmailIntegrationSettings(parsed, defaultEmailConfig);
        setSettings(normalized);
        return;
      }

      const legacyRaw = window.localStorage.getItem('feedback-settings');
      if (legacyRaw) {
        try {
          const legacy = JSON.parse(legacyRaw) as Partial<{
            emailServiceId?: unknown;
            emailTemplateId?: unknown;
            emailPublicKey?: unknown;
          }>;
          const serviceId =
            typeof legacy.emailServiceId === 'string' && legacy.emailServiceId.trim().length > 0
              ? legacy.emailServiceId
              : defaultEmailConfig.serviceId;
          const templateId =
            typeof legacy.emailTemplateId === 'string' && legacy.emailTemplateId.trim().length > 0
              ? legacy.emailTemplateId
              : defaultEmailConfig.templateId;
          const publicKey =
            typeof legacy.emailPublicKey === 'string' && legacy.emailPublicKey.trim().length > 0
              ? legacy.emailPublicKey
              : defaultEmailConfig.publicKey;

          if (serviceId || templateId || publicKey) {
            const migrated: EmailIntegrationSettings = {
              ...defaultSettings,
              emailConfig: {
                serviceId,
                templateId,
                publicKey,
              },
            };
            const normalizedMigrated = normalizeEmailIntegrationSettings(migrated, defaultEmailConfig);
            setSettings(normalizedMigrated);
            window.localStorage.setItem(
              EMAIL_INTEGRATIONS_STORAGE_KEY,
              JSON.stringify(normalizedMigrated),
            );
          }
        } catch (legacyError) {
          console.warn('[kiwify-hub] não foi possível migrar configurações legadas de e-mail', legacyError);
        }
      }
    } catch (error) {
      console.warn('[kiwify-hub] não foi possível carregar as configurações de e-mail', error);
    }
  }, [defaultEmailConfig, defaultSettings]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null,
    [selectedTemplateId, templates],
  );

  const handleTemplateChange = <Field extends keyof EmailTemplate>(
    id: string,
    field: Field,
    value: EmailTemplate[Field],
  ) => {
    setSettings((prev) => ({
      ...prev,
      templates: prev.templates.map((template) =>
        template.id === id
          ? {
              ...template,
              [field]: value,
            }
          : template,
      ),
    }));
  };

  const handleSelectTemplate = (templateId: string) => {
    setSettings((prev) => ({
      ...prev,
      selectedTemplateId: templateId,
    }));
  };

  const handleAddTemplate = () => {
    const now = Date.now();
    const newTemplate: EmailTemplate = {
      id: `custom-${now}`,
      name: 'Novo template',
      description: 'HTML personalizado criado pela sua equipe.',
      subject: 'Defina o assunto do novo template',
      html: `<h1>Seu conteúdo aqui</h1>\n<p>Utilize {{{body}}} no EmailJS para receber o HTML final gerado pelo app.</p>`,
    };
    setSettings((prev) => {
      const nextTemplates = [...prev.templates, newTemplate];
      return {
        ...prev,
        templates: nextTemplates,
        selectedTemplateId: newTemplate.id,
        flowSettings: syncFlowSettingsWithTemplates(prev.flowSettings, nextTemplates),
      };
    });
  };

  const handleRemoveTemplate = (templateId: string) => {
    setSettings((prev) => {
      const filtered = prev.templates.filter((template) => template.id !== templateId);
      const fallbackId = filtered[0]?.id ?? prev.templates[0]?.id ?? '';
      return {
        ...prev,
        templates: filtered,
        selectedTemplateId:
          prev.selectedTemplateId === templateId
            ? fallbackId
            : prev.selectedTemplateId,
        flowSettings: syncFlowSettingsWithTemplates(prev.flowSettings, filtered),
      };
    });
  };

  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedbackMessage('');
    window.setTimeout(() => {
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(EMAIL_INTEGRATIONS_STORAGE_KEY, JSON.stringify(settings));
        }
        setFeedbackMessage('Configurações salvas com sucesso.');
      } catch (error) {
        console.warn('[kiwify-hub] não foi possível salvar as configurações de e-mail', error);
        setFeedbackMessage('Não foi possível salvar as configurações. Tente novamente.');
      } finally {
        setIsSaving(false);
      }
    }, 600);
  };

  const renderTemplateField = <Field extends keyof EmailTemplate>(
    field: Field,
    label: string,
    type: 'text' | 'textarea' = 'text',
  ) => {
    if (!selectedTemplate) {
      return null;
    }

    const commonProps = {
      id: `${field}-${selectedTemplate.id}`,
      name: `${field}-${selectedTemplate.id}`,
      value: selectedTemplate[field] as string,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        handleTemplateChange(selectedTemplate.id, field, event.target.value as EmailTemplate[Field]),
      className:
        'w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none',
    };

    if (type === 'textarea') {
      return (
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-white">{label}</span>
          <textarea
            {...commonProps}
            rows={10}
            placeholder="Cole aqui o HTML personalizado que será injetado pelo EmailJS."
          />
        </label>
      );
    }

    return (
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-white">{label}</span>
        <input
          {...commonProps}
          type="text"
          placeholder="Informe o valor"
        />
      </label>
    );
  };

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <IntegrationSection
        title="Credenciais do EmailJS"
        description="As credenciais são carregadas automaticamente das variáveis de ambiente configuradas na Vercel e são aplicadas em todos os envios."
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Para alterar Service ID, Template ID ou Public Key, atualize as variáveis <code>NEXT_PUBLIC_EMAILJS_*</code> no projeto.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-white">Service ID</span>
              <input
                type="text"
                value={emailConfig.serviceId}
                readOnly
                className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white focus:outline-none"
                placeholder="Defina via ambiente"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-white">Template ID</span>
              <input
                type="text"
                value={emailConfig.templateId}
                readOnly
                className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white focus:outline-none"
                placeholder="Defina via ambiente"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-white">Chave pública</span>
              <input
                type="text"
                value={emailConfig.publicKey}
                readOnly
                className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white focus:outline-none"
                placeholder="Defina via ambiente"
              />
            </label>
          </div>
        </div>
      </IntegrationSection>

      <IntegrationSection
        title="Orquestração de envios"
        description="Determine como o fluxo de e-mails será executado em sua operação."
      >
        <div className="grid gap-4">
          {toggles.map((toggle) => (
            <label
              key={toggle.id}
              htmlFor={toggle.id}
              className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-brand/60 hover:bg-slate-900"
            >
              <div>
                <p className="text-sm font-semibold text-white">{toggle.label}</p>
                <p className="text-xs text-slate-400">{toggle.description}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Status</span>
                <input
                  id={toggle.id}
                  name={toggle.id}
                  type="checkbox"
                  defaultChecked={toggle.defaultChecked}
                  className="h-5 w-10 accent-brand"
                />
              </div>
            </label>
          ))}
        </div>
      </IntegrationSection>

      <IntegrationSection
        title="Templates do EmailJS"
        description="Gerencie os templates HTML que serão enviados com {{{body}}} diretamente pelo app."
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Templates configurados</h3>
              <p className="text-xs text-slate-400">
                Adicione novos templates ou edite os existentes para reutilizar no EmailJS.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddTemplate}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-brand/60 bg-brand/10 px-4 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white"
            >
              Adicionar template
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
              <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Template
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Assunto
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {templates.map((template) => {
                  const isActive = template.id === selectedTemplate?.id;
                  return (
                    <tr
                      key={template.id}
                      className={`cursor-pointer transition hover:bg-slate-900/70 ${
                        isActive ? 'bg-slate-900/80' : ''
                      }`}
                      onClick={() => handleSelectTemplate(template.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white">{template.name}</span>
                          <span className="text-xs text-slate-500">{template.description}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-200">{template.subject}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSelectTemplate(template.id);
                          }}
                          className="text-xs font-semibold text-brand hover:text-brand/80"
                        >
                          Editar
                        </button>
                        {templates.length > 1 && template.id !== 'remarketing' && template.id !== 'feedback' ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRemoveTemplate(template.id);
                            }}
                            className="ml-3 text-xs font-semibold text-rose-400 hover:text-rose-300"
                          >
                            Remover
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedTemplate ? (
            <div className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-6 md:grid-cols-2">
              <div className="md:col-span-2 flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Template selecionado</span>
                <input
                  type="text"
                  value={selectedTemplate.name}
                  onChange={(event) => handleTemplateChange(selectedTemplate.id, 'name', event.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm font-semibold text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
                  placeholder="Nome interno do template"
                />
              </div>
              <label className="flex flex-col gap-2 text-sm md:col-span-2">
                <span className="font-medium text-white">Descrição</span>
                <input
                  type="text"
                  value={selectedTemplate.description}
                  onChange={(event) => handleTemplateChange(selectedTemplate.id, 'description', event.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
                  placeholder="Breve descrição do template"
                />
              </label>
              {renderTemplateField('subject', 'Assunto do e-mail')}
              <div className="md:col-span-2">
                {renderTemplateField('html', 'HTML do template (utilize {{{body}}} no EmailJS)', 'textarea')}
              </div>
            </div>
          ) : null}
        </div>
      </IntegrationSection>

      <IntegrationSection
        title="Remetente padrão"
        description="Defina qual endereço será exibido como remetente nos disparos."
      >
        <div className="flex flex-col gap-2 text-sm">
          <label htmlFor="from-email" className="font-medium text-white">
            E-mail do remetente
          </label>
          <input
            id="from-email"
            type="email"
            name="from-email"
            value={fromEmail}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                fromEmail: event.target.value,
              }))
            }
            placeholder="contato@sualoja.com"
            className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
          />
        </div>
        <IntegrationGuideLink guidePath="/guides/emails.md" label="Baixar regras e lógica de e-mail" />
      </IntegrationSection>

      <IntegrationSection
        title="Templates por status"
        description="Escolha qual template será utilizado por padrão em cada fluxo e defina se o envio está ativo."
      >
        <div className="space-y-4">
          {EMAIL_FLOW_CONFIGS.map((flow) => {
            const setting = flowSettings[flow.id];
            const selectedId = setting?.templateId ?? templates[0]?.id ?? '';
            const isEnabled = setting?.enabled ?? true;

            return (
              <div
                key={flow.id}
                className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
              >
                <div>
                  <h3 className="text-sm font-semibold text-white">{flow.label}</h3>
                  <p className="text-xs text-slate-400">{flow.description}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium text-white">Template padrão</span>
                    <select
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                      value={selectedId}
                      onChange={(event) => {
                        const nextTemplateId = event.target.value;
                        setSettings((prev) => ({
                          ...prev,
                          flowSettings: syncFlowSettingsWithTemplates(
                            {
                              ...prev.flowSettings,
                              [flow.id]: {
                                ...prev.flowSettings[flow.id],
                                templateId: nextTemplateId,
                                enabled: prev.flowSettings[flow.id]?.enabled ?? flow.defaultEnabled,
                              },
                            },
                            prev.templates,
                          ),
                        }));
                      }}
                    >
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-white">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</span>
                      <span className="text-sm font-semibold text-white">{isEnabled ? 'Ativo' : 'Desativado'}</span>
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-10 accent-brand"
                      checked={isEnabled}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          flowSettings: {
                            ...prev.flowSettings,
                            [flow.id]: {
                              ...prev.flowSettings[flow.id],
                              templateId: selectedId,
                              enabled: event.target.checked,
                            },
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </IntegrationSection>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {feedbackMessage ? (
          <p className="text-sm font-medium text-emerald-400" role="status" aria-live="polite">
            {feedbackMessage}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </form>
  );
}
