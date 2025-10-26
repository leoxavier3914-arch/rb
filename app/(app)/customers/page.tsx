export default function CustomersPage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Clientes</h1>
        <p className="mt-2 text-sm text-slate-600">
          A visualização agregada por estado e país ficará disponível nesta área assim que os recursos estiverem
          prontos.
        </p>
      </header>

      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Acompanhe aqui futuramente a lista completa de clientes e suas métricas agrupadas.
      </section>
    </main>
  );
}
