'use client';

import { FormEvent, useState } from 'react';
import IntegrationGuideLink from '../../../components/IntegrationGuideLink';
import IntegrationSection from '../../../components/IntegrationSection';

const toggles = [
  {
    id: 'instagram-direct-manual',
    label: 'Respostas manuais',
    description: 'Ative para responder clientes diretamente pelo hub sem sair da plataforma.',
    defaultChecked: true,
  },
  {
    id: 'instagram-direct-automation',
    label: 'Sequência automática',
    description: 'Envia respostas automáticas com base em palavras-chave e eventos de compra.',
    defaultChecked: true,
  },
  {
    id: 'instagram-comment-monitoring',
    label: 'Monitorar comentários',
    description: 'Captura comentários públicos e inicia uma conversa no Direct automaticamente.',
    defaultChecked: false,
  },
];

export default function InstagramIntegrationsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedbackMessage('');

    window.setTimeout(() => {
      setIsSaving(false);
      setFeedbackMessage('Configurações salvas com sucesso.');
    }, 600);
  };

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <IntegrationSection
        title="Fluxos de Direct"
        description="Controle a forma como os leads do Instagram são atendidos."
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
        title="Credenciais e gatilhos"
        description="Defina qual conta será monitorada e como as mensagens serão disparadas."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">Usuário da conta</span>
            <input
              type="text"
              name="instagram-user"
              placeholder="@sualoja"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">ID do aplicativo</span>
            <input
              type="text"
              name="instagram-app-id"
              placeholder="Fornecido no painel Meta for Developers"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">Token de longa duração</span>
            <input
              type="password"
              name="instagram-token"
              placeholder="Cole o token gerado pela Meta"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">Mensagem de boas-vindas</span>
            <textarea
              name="instagram-welcome"
              rows={5}
              placeholder="Mensagem enviada ao iniciar uma conversa automática."
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
              defaultValue={`Oi {{nome}}, vimos a sua mensagem no Instagram e queremos te ajudar com a sua experiência.`}
            />
          </label>
        </div>
      </IntegrationSection>

      <IntegrationSection
        title="Testes e materiais"
        description="Realize um envio rápido de teste e compartilhe o funcionamento com o time."
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2 text-sm">
            <label htmlFor="test-instagram" className="font-medium text-white">
              Enviar Direct de teste
            </label>
            <input
              id="test-instagram"
              type="text"
              name="test-instagram"
              placeholder="@usuario"
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
        <IntegrationGuideLink guidePath="/guides/instagram.md" label="Baixar regras e lógica do Instagram" />
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
