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

const serviceProviders = ['EmailJS', 'Amazon SES', 'Sendgrid', 'Outro'];

export default function EmailIntegrationsPage() {
  return (
    <form className="space-y-8">
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
        title="Template e personalização"
        description="Escolha o provedor responsável pelos envios e defina os blocos do e-mail."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">Assunto padrão</span>
            <input
              type="text"
              name="email-subject"
              placeholder="Ex: Como foi a sua experiência com a nossa loja?"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
              defaultValue="Queremos ouvir a sua experiência com a Kiwify"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">Remetente</span>
            <input
              type="email"
              name="email-from"
              placeholder="contato@sualoja.com"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
              defaultValue="contato@kiwifyhub.com"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-white">Provedor</span>
            <select
              name="email-service"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
              defaultValue={serviceProviders[0]}
            >
              {serviceProviders.map((provider) => (
                <option key={provider}>{provider}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm md:col-span-2">
            <span className="font-medium text-white">Template HTML</span>
            <textarea
              name="email-template"
              rows={8}
              placeholder="Cole o HTML do template que será utilizado nos envios de feedback."
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
              defaultValue={`<h1>Obrigado pela compra!</h1>\n<p>Queremos muito saber como foi a sua experiência.</p>`}
            />
          </label>
        </div>
      </IntegrationSection>

      <IntegrationSection
        title="Testes e documentação"
        description="Execute um disparo isolado e compartilhe o material de apoio com a sua equipe."
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2 text-sm">
            <label htmlFor="test-email" className="font-medium text-white">
              Enviar e-mail de teste
            </label>
            <input
              id="test-email"
              type="email"
              name="test-email"
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
