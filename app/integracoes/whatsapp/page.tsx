'use client';

import { FormEvent, useState } from 'react';
import IntegrationGuideLink from '../../../components/IntegrationGuideLink';
import IntegrationSection from '../../../components/IntegrationSection';

const toggles = [
  {
    id: 'manual-whatsapp-delivery',
    label: 'Envio manual',
    description: 'Permite selecionar clientes e enviar mensagens diretamente pelo painel.',
    defaultChecked: true,
  },
  {
    id: 'automatic-whatsapp-delivery',
    label: 'Automação de follow-up',
    description: 'Dispara mensagens automáticas com base em eventos de compra e carrinhos.',
    defaultChecked: true,
  },
  {
    id: 'whatsapp-smart-filters',
    label: 'Filtro de disponibilidade',
    description: 'Respeita janelas de atendimento para evitar envios em horários indevidos.',
    defaultChecked: true,
  },
];

type WhatsappMessage = {
  id: string;
  name: string;
  description: string;
  content: string;
};

const defaultMessages: WhatsappMessage[] = [
  {
    id: 'remarketing',
    name: 'WhatsApp remarketing',
    description: 'Mensagem enviada para retomar contato com quem abandonou o carrinho.',
    content:
      'Oi {{nome}}, percebemos que você deixou alguns itens no carrinho. Posso te ajudar a finalizar a compra?',
  },
  {
    id: 'feedback',
    name: 'WhatsApp feedback',
    description: 'Mensagem utilizada para solicitar a avaliação do cliente após a entrega.',
    content:
      'Olá {{nome}}! Gostaríamos de saber como foi a sua experiência com a Kiwify. Pode compartilhar um feedback rápido?',
  },
];

export default function WhatsappIntegrationsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [messages, setMessages] = useState<WhatsappMessage[]>(defaultMessages);
  const [selectedMessageId, setSelectedMessageId] = useState<string>(defaultMessages[0]?.id ?? '');

  const selectedMessage = messages.find((message) => message.id === selectedMessageId) ?? null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedbackMessage('');

    window.setTimeout(() => {
      setIsSaving(false);
      setFeedbackMessage('Configurações salvas com sucesso.');
    }, 600);
  };

  const handleSelectMessage = (messageId: string) => {
    setSelectedMessageId(messageId);
  };

  const handleAddMessage = () => {
    const timestamp = Date.now();
    const newMessage: WhatsappMessage = {
      id: `custom-${timestamp}`,
      name: 'Nova mensagem',
      description: 'Descreva o objetivo dessa mensagem automática.',
      content: 'Escreva aqui o conteúdo que será enviado pelo WhatsApp.',
    };

    setMessages((prev) => [...prev, newMessage]);
    setSelectedMessageId(newMessage.id);
  };

  const handleRemoveMessage = (messageId: string) => {
    const remainingMessages = messages.filter((message) => message.id !== messageId);
    setMessages(remainingMessages);

    if (messageId === selectedMessageId) {
      setSelectedMessageId(remainingMessages[0]?.id ?? '');
    }
  };

  const handleMessageChange = <K extends keyof WhatsappMessage>(
    messageId: string,
    field: K,
    value: WhatsappMessage[K],
  ) => {
    setMessages((prev) =>
      prev.map((message) => (message.id === messageId ? { ...message, [field]: value } : message)),
    );
  };

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <IntegrationSection
        title="Fluxos e horários"
        description="Configure como a automação do WhatsApp se comporta no dia a dia."
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
        title="Credenciais do WhatsApp Business"
        description="Informe os dados utilizados para autenticar a sua instância oficial."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">Número principal</span>
            <input
              type="tel"
              name="whatsapp-number"
              placeholder="55 11 91234-5678"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
              defaultValue="55 11 99999-0000"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">Business ID</span>
            <input
              type="text"
              name="whatsapp-business-id"
              placeholder="ID fornecido pela Meta"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">Token de acesso</span>
            <input
              type="password"
              name="whatsapp-token"
              placeholder="Cole o token gerado na Meta"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">Mensagem inicial padrão</span>
            <textarea
              name="whatsapp-template"
              rows={5}
              placeholder="Mensagem enviada automaticamente após a compra ou abandono de carrinho."
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
              defaultValue={`Oi {{nome}}, tudo bem? Sou da equipe Kiwify e gostaria de saber como foi a sua experiência.`}
            />
          </label>
        </div>
      </IntegrationSection>

      <IntegrationSection
        title="Mensagens automáticas"
        description="Gerencie as mensagens utilizadas nas jornadas de remarketing e feedback."
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Mensagens configuradas</h3>
              <p className="text-xs text-slate-400">
                Ajuste os textos enviados pela automação ou adicione novas mensagens personalizadas.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddMessage}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-brand/60 bg-brand/10 px-4 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white"
            >
              Adicionar mensagem
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
              <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Mensagem
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Pré-visualização
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {messages.map((message) => {
                  const isActive = message.id === selectedMessage?.id;
                  const preview = message.content.length > 80 ? `${message.content.slice(0, 80)}...` : message.content;

                  return (
                    <tr
                      key={message.id}
                      className={`cursor-pointer transition hover:bg-slate-900/70 ${isActive ? 'bg-slate-900/80' : ''}`}
                      onClick={() => handleSelectMessage(message.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white">{message.name}</span>
                          <span className="text-xs text-slate-500">{message.description}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-200">{preview}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSelectMessage(message.id);
                          }}
                          className="text-xs font-semibold text-brand hover:text-brand/80"
                        >
                          Editar
                        </button>
                        {messages.length > 1 && message.id !== 'remarketing' && message.id !== 'feedback' ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRemoveMessage(message.id);
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

          {selectedMessage ? (
            <div className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Mensagem selecionada</span>
                <input
                  type="text"
                  value={selectedMessage.name}
                  onChange={(event) => handleMessageChange(selectedMessage.id, 'name', event.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm font-semibold text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
                  placeholder="Nome interno da mensagem"
                />
              </div>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-white">Descrição</span>
                <input
                  type="text"
                  value={selectedMessage.description}
                  onChange={(event) => handleMessageChange(selectedMessage.id, 'description', event.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
                  placeholder="Breve descrição sobre quando a mensagem será utilizada"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-white">Conteúdo da mensagem</span>
                <textarea
                  rows={6}
                  value={selectedMessage.content}
                  onChange={(event) => handleMessageChange(selectedMessage.id, 'content', event.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
                  placeholder="Digite o texto enviado pelo WhatsApp"
                />
                <span className="text-xs text-slate-500">
                  {'Utilize variáveis como {{nome}} para personalizar automaticamente cada mensagem.'}
                </span>
              </label>
            </div>
          ) : null}
        </div>
      </IntegrationSection>

      <IntegrationSection
        title="Testes e materiais"
        description="Faça um disparo controlado e distribua o guia para a equipe de atendimento."
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2 text-sm">
            <label htmlFor="test-whatsapp" className="font-medium text-white">
              Enviar mensagem de teste
            </label>
            <input
              id="test-whatsapp"
              type="tel"
              name="test-whatsapp"
              placeholder="55 11 90000-0000"
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
        <IntegrationGuideLink guidePath="/guides/whatsapp.md" label="Baixar regras e lógica do WhatsApp" />
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
