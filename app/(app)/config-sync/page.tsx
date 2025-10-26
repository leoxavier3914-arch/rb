export default function ConfigSyncPage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Sincronização &amp; Configurações</h1>
        <p className="mt-2 text-sm text-slate-600">
          A central de controles para renovar tokens, executar backfills e retentar webhooks será adicionada
          em breve.
        </p>
      </header>

      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Esta página concentrará as ações administrativas relacionadas ao conector da Kiwify.
      </section>
    </main>
  );
}
