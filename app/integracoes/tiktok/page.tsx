'use client';

import { FormEvent, useState } from 'react';
import IntegrationGuideLink from '../../../components/IntegrationGuideLink';
import IntegrationSection from '../../../components/IntegrationSection';

const toggles = [
  {
    id: 'tiktok-manual-reach',
    label: 'Contato manual',
    description: 'Permite responder leads vindos do TikTok diretamente pela plataforma.',
    defaultChecked: true,
  },
  {
    id: 'tiktok-automation',
    label: 'Fluxo automático',
    description: 'Aciona mensagens automáticas após interações em anúncios e lives.',
    defaultChecked: true,
  },
  {
    id: 'tiktok-comment-sync',
    label: 'Sincronizar comentários',
    description: 'Captura comentários em vídeos e cria tarefas de acompanhamento.',
    defaultChecked: false,
  },
];

export default function TiktokIntegrationsPage() {
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
        title="Fluxos de relacionamento"
        description="Defina como iremos abordar os contatos gerados pelos seus conteúdos no TikTok."
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
        title="Credenciais e públicos"
        description="Configure os tokens oficiais e defina quais públicos serão nutridos."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">ID do anunciante</span>
            <input
              type="text"
              name="tiktok-advertiser-id"
              placeholder="ID disponibilizado no TikTok Ads"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">Token de acesso</span>
            <input
              type="password"
              name="tiktok-token"
              placeholder="Cole o token gerado no TikTok"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">Segmento prioritário</span>
            <select
              name="tiktok-segment"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
              defaultValue="Leads de live"
            >
              <option>Leads de live</option>
              <option>Mensagens de anúncios</option>
              <option>Comentários em vídeos</option>
              <option>Todos os contatos</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">Mensagem de abertura</span>
            <textarea
              name="tiktok-opening"
              rows={5}
              placeholder="Texto enviado automaticamente na primeira abordagem."
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
              defaultValue={`Olá {{nome}}, aqui é a equipe Kiwify! Vimos sua interação no TikTok e queremos falar com você.`}
            />
          </label>
        </div>
      </IntegrationSection>

      <IntegrationSection
        title="Testes e documentação"
        description="Valide as automações e salve o guia para treinar a equipe."
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2 text-sm">
            <label htmlFor="test-tiktok" className="font-medium text-white">
              Enviar mensagem de teste
            </label>
            <input
              id="test-tiktok"
              type="text"
              name="test-tiktok"
              placeholder="ID de usuário ou telefone"
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
        <IntegrationGuideLink guidePath="/guides/tiktok.md" label="Baixar regras e lógica do TikTok" />
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
