'use client';

import { EmptyState } from '@/components/ui/EmptyState';

export default function CustomersPage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Clientes</h1>
        <p className="mt-2 text-sm text-slate-600">
          A visualização agregada por estado e país ficará disponível nesta área assim que os recursos estiverem prontos.
        </p>
      </header>

      <EmptyState
        title="Visão de clientes em desenvolvimento"
        description="Acompanhe aqui futuramente a lista completa de clientes, métricas e agrupamentos por região."
      />
    </main>
  );
}
