'use client';

import { FormEvent, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OperationResult } from '@/components/ui/operation-result';
import { callKiwifyAdminApi } from '@/lib/ui/kiwifyAdminApi';
import { useOperation } from '@/lib/ui/useOperation';

export default function ProductsPage() {
  const listProducts = useOperation<unknown>();
  const productDetails = useOperation<unknown>();

  const [pageSize, setPageSize] = useState('');
  const [page, setPage] = useState('');
  const [detailProductId, setDetailProductId] = useState('');

  const handleListProducts = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const search = new URLSearchParams();
      if (pageSize.trim() !== '') {
        search.set('page_size', pageSize.trim());
      }
      if (page.trim() !== '') {
        search.set('page', page.trim());
      }
      const query = search.toString();

      await listProducts.run(() =>
        callKiwifyAdminApi(
          `/api/kfy/products${query ? `?${query}` : ''}`,
          {},
          'Erro ao listar produtos.'
        )
      );
    },
    [listProducts, page, pageSize]
  );

  const handleProductDetails = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (detailProductId.trim() === '') {
        productDetails.reset();
        return;
      }

      await productDetails.run(() =>
        callKiwifyAdminApi(
          `/api/kfy/products/${encodeURIComponent(detailProductId.trim())}`,
          {},
          'Erro ao consultar produto.'
        )
      );
    },
    [detailProductId, productDetails]
  );

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Produtos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Consulte o catálogo da Kiwify usando os filtros disponíveis ou busque diretamente por um produto específico.
        </p>
      </header>

      <section>
        <Card>
          <CardHeader>
          <CardTitle>Listar produtos</CardTitle>
          <CardDescription>Retorne o catálogo paginado com base nos filtros opcionais de página e tamanho.</CardDescription>
          </CardHeader>
          <CardContent>
          <form className="space-y-4" onSubmit={handleListProducts}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Tamanho da página
                <input
                  type="number"
                  min={1}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={pageSize}
                  onChange={event => setPageSize(event.target.value)}
                  placeholder="10"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Número da página
                <input
                  type="number"
                  min={1}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={page}
                  onChange={event => setPage(event.target.value)}
                  placeholder="1"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={listProducts.loading}>
                {listProducts.loading ? 'Consultando…' : 'Listar produtos'}
              </Button>
              {!!listProducts.data && !listProducts.loading && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPageSize('');
                    setPage('');
                    listProducts.reset();
                  }}
                >
                  Limpar resultado
                </Button>
              )}
            </div>
          </form>
          <OperationResult loading={listProducts.loading} error={listProducts.error} data={listProducts.data} />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
          <CardTitle>Consultar produto</CardTitle>
          <CardDescription>Informe o ID do produto para buscar os detalhes oficiais diretamente na Kiwify.</CardDescription>
          </CardHeader>
          <CardContent>
          <form className="space-y-4" onSubmit={handleProductDetails}>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              ID do produto
              <input
                type="text"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                value={detailProductId}
                onChange={event => setDetailProductId(event.target.value)}
                placeholder="prod_xxxxx"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={productDetails.loading}>
                {productDetails.loading ? 'Consultando…' : 'Consultar produto'}
              </Button>
              {!!productDetails.data && !productDetails.loading && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDetailProductId('');
                    productDetails.reset();
                  }}
                >
                  Limpar resultado
                </Button>
              )}
            </div>
          </form>
          <OperationResult
            loading={productDetails.loading}
            error={productDetails.error}
            data={productDetails.data}
          />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
