export default function ProductsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Produtos</h1>
        <p className="mt-2 text-sm text-slate-600">
          A listagem local de produtos sincronizados ainda não está disponível, mas chegará em breve.
        </p>
      </header>

      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Utilize esta página futuramente para explorar o catálogo e aplicar filtros avançados.
      </section>
    </main>
  );
}
