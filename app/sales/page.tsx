export default function SalesPage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Vendas</h1>
        <p className="mt-2 text-sm text-slate-600">
          Em breve você poderá filtrar, favoritar e reorganizar a visualização das vendas diretamente no Hub.
        </p>
      </header>

      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        A tabela detalhada de vendas com linha do tempo, notas e histórico de versões será exibida aqui assim que
        o módulo estiver concluído.
      </section>
    </main>
  );
}
