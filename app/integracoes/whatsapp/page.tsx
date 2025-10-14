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

export default function WhatsappIntegrationsPage() {
  return (
    <form className="space-y-8">
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
