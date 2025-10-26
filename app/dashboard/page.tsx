export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          A visão consolidada do hub ainda está em desenvolvimento. Em breve você poderá acompanhar métricas
          avançadas diretamente por aqui.
        </p>
      </header>

      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Os cards de métricas, ranking de produtos e comparações por período serão disponibilizados nesta seção.
      </section>
    </main>
  );
}
