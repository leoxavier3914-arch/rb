"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import IntegrationGuideLink from '../../../components/IntegrationGuideLink';
import IntegrationSection from '../../../components/IntegrationSection';

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

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  serviceId: string;
  templateId: string;
  description: string;
  html: string;
};

const defaultTemplates: EmailTemplate[] = [
  {
    id: 'remarketing',
    name: 'E-mail de remarketing',
    description: 'Carrinhos abandonados, enviado automaticamente como hoje.',
    subject: 'Seu carrinho está te esperando na Kiwify',
    serviceId: 'emailjs_remarketing',
    templateId: 'template_remarketing',
    html: `<h1>Volte para finalizar a compra ❤️</h1>\n<p>Notamos que você deixou itens no carrinho. Clique no botão abaixo para concluir.</p>\n<a href="{{{checkoutUrl}}}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;">Finalizar compra</a>`,
  },
  {
    id: 'feedback',
    name: 'E-mail de feedback',
    description: 'Disparado para vendas aprovadas pedindo a avaliação do cliente.',
    subject: 'Como foi a sua experiência com a Kiwify?',
    serviceId: 'emailjs_feedback',
    templateId: 'template_feedback',
    html: `<h1>Queremos ouvir você!</h1>\n<p>Conte como foi a sua experiência respondendo nosso rápido formulário.</p>\n<p>Obrigado por comprar com a gente 💜</p>`,
  },
];

export default function EmailIntegrationsPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>(defaultTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTemplates[0]?.id ?? '');
  const [fromEmail, setFromEmail] = useState('contato@kiwifyhub.com');
  const [testEmail, setTestEmail] = useState('');

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null,
    [selectedTemplateId, templates],
  );

  const handleTemplateChange = <Field extends keyof EmailTemplate>(
    id: string,
    field: Field,
    value: EmailTemplate[Field],
  ) => {
    setTemplates((prev) =>
      prev.map((template) =>
        template.id === id
          ? {
              ...template,
              [field]: value,
            }
          : template,
      ),
    );
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };

  const handleAddTemplate = () => {
    const now = Date.now();
    const newTemplate: EmailTemplate = {
      id: `custom-${now}`,
      name: 'Novo template',
      description: 'HTML personalizado criado pela sua equipe.',
      subject: 'Defina o assunto do novo template',
      serviceId: 'emailjs_service_id',
      templateId: 'emailjs_template_id',
      html: `<h1>Seu conteúdo aqui</h1>\n<p>Utilize {{{body}}} no EmailJS para receber o HTML final gerado pelo app.</p>`,
    };
    setTemplates((prev) => [...prev, newTemplate]);
    setSelectedTemplateId(newTemplate.id);
  };

  const handleRemoveTemplate = (templateId: string) => {
    setTemplates((prev) => {
      const filtered = prev.filter((template) => template.id !== templateId);
      if (templateId === selectedTemplateId) {
        setSelectedTemplateId(filtered[0]?.id ?? '');
      }
      return filtered;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // eslint-disable-next-line no-console
    console.log('Configurações salvas', {
      fromEmail,
      templates,
    });
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
                  <th scope="col" className="px-4 py-3">
                    Service ID
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Template ID
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
                      <td className="px-4 py-3 text-xs font-mono text-slate-400">{template.serviceId}</td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-400">{template.templateId}</td>
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
              {renderTemplateField('subject', 'Assunto do e-mail')}
              {renderTemplateField('serviceId', 'Service ID')}
              {renderTemplateField('templateId', 'Template ID')}
              <div className="md:col-span-2">
                {renderTemplateField('html', 'HTML do template (utilize {{{body}}} no EmailJS)', 'textarea')}
              </div>
            </div>
          ) : null}
        </div>
      </IntegrationSection>

      <IntegrationSection
        title="Testes e documentação"
        description="Execute um disparo isolado e compartilhe o material de apoio com a sua equipe."
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2 text-sm">
            <label htmlFor="from-email" className="font-medium text-white">
              Remetente padrão
            </label>
            <input
              id="from-email"
              type="email"
              name="from-email"
              value={fromEmail}
              onChange={(event) => setFromEmail(event.target.value)}
              placeholder="contato@sualoja.com"
              className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
            />
          </div>
          <div className="flex flex-1 flex-col gap-2 text-sm">
            <label htmlFor="test-email" className="font-medium text-white">
              Enviar e-mail de teste
            </label>
            <input
              id="test-email"
              type="email"
              name="test-email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="nome@suaempresa.com"
              className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
            />
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand/90"
          >
            Enviar teste
          </button>
        </div>
        <IntegrationGuideLink guidePath="/guides/emails.md" label="Baixar regras e lógica de e-mail" />
      </IntegrationSection>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand/90"
        >
          Salvar configurações
        </button>
      </div>
    </form>
  );
}
