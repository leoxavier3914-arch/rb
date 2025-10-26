'use client';

import { EmptyState } from '@/components/ui/EmptyState';

export default function ProductsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Produtos</h1>
        <p className="mt-2 text-sm text-slate-600">
          A listagem local de produtos sincronizados ainda não está disponível, mas chegará em breve.
        </p>
      </header>

      <EmptyState
        title="Catálogo em preparação"
        description="Utilize esta página futuramente para explorar o catálogo sincronizado e aplicar filtros avançados."
      />
    </main>
  );
}
