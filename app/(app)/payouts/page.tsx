export default function PayoutsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Repasses</h1>
        <p className="mt-2 text-sm text-slate-600">
          Acompanhe os pagamentos processados pela Kiwify nesta página assim que o módulo estiver pronto.
        </p>
      </header>

      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Este espaço receberá a listagem completa com filtros e paginação dos repasses.
      </section>
    </main>
  );
}
