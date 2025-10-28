'use client';

import { FormEvent, useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OperationResult } from '@/components/ui/operation-result';
import { callKiwifyAdminApi } from '@/lib/ui/kiwifyAdminApi';
import { useOperation } from '@/lib/ui/useOperation';

export default function WebhooksPage() {
  const listOperation = useOperation<unknown>();
  const detailOperation = useOperation<unknown>();
  const createOperation = useOperation<unknown>();
  const updateOperation = useOperation<unknown>();
  const deleteOperation = useOperation<unknown>();

  const [pageSize, setPageSize] = useState('');
  const [page, setPage] = useState('');
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');

  const [detailId, setDetailId] = useState('');
  const [deleteId, setDeleteId] = useState('');

  const [createName, setCreateName] = useState('');
  const [createUrl, setCreateUrl] = useState('');
  const [createProducts, setCreateProducts] = useState('all');
  const [createTriggers, setCreateTriggers] = useState('');
  const [createToken, setCreateToken] = useState('');

  const [updateId, setUpdateId] = useState('');
  const [updateName, setUpdateName] = useState('');
  const [updateUrl, setUpdateUrl] = useState('');
  const [updateProducts, setUpdateProducts] = useState('all');
  const [updateTriggers, setUpdateTriggers] = useState('');
  const [updateToken, setUpdateToken] = useState('');

  const parseTriggers = useCallback((value: string) => {
    return value
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean);
  }, []);

  const handleList = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const params = new URLSearchParams();
      if (pageSize.trim() !== '') {
        params.set('page_size', pageSize.trim());
      }
      if (page.trim() !== '') {
        params.set('page', page.trim());
      }
      if (productId.trim() !== '') {
        params.set('product_id', productId.trim());
      }
      if (search.trim() !== '') {
        params.set('search', search.trim());
      }

      await listOperation.run(() =>
        callKiwifyAdminApi(`/api/kfy/webhooks?${params.toString()}`, {}, 'Erro ao listar webhooks.')
      );
    },
    [listOperation, page, pageSize, productId, search]
  );

  const handleDetail = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (detailId.trim() === '') {
        detailOperation.reset();
        return;
      }
      await detailOperation.run(() =>
        callKiwifyAdminApi(
          `/api/kfy/webhooks/${encodeURIComponent(detailId.trim())}`,
          {},
          'Erro ao consultar webhook.'
        )
      );
    },
    [detailId, detailOperation]
  );

  const handleCreate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      await createOperation.run(async () => {
        const triggers = parseTriggers(createTriggers);
        if (createName.trim() === '' || createUrl.trim() === '' || triggers.length === 0) {
          throw new Error('Preencha nome, URL e triggers para criar o webhook.');
        }

        const body: Record<string, unknown> = {
          name: createName.trim(),
          url: createUrl.trim(),
          products: createProducts.trim(),
          triggers,
          token: createToken.trim() === '' ? undefined : createToken.trim()
        };

        return callKiwifyAdminApi(
          '/api/kfy/webhooks',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
          },
          'Erro ao criar webhook.'
        );
      });
    },
    [createName, createOperation, createProducts, createToken, createTriggers, createUrl, parseTriggers]
  );

  const handleUpdate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (updateId.trim() === '') {
        updateOperation.reset();
        return;
      }

      await updateOperation.run(async () => {
        const triggers = parseTriggers(updateTriggers);
        if (updateName.trim() === '' || updateUrl.trim() === '' || triggers.length === 0) {
          throw new Error('Preencha nome, URL e triggers para atualizar o webhook.');
        }

        const body: Record<string, unknown> = {
          name: updateName.trim(),
          url: updateUrl.trim(),
          products: updateProducts.trim(),
          triggers,
          token: updateToken.trim() === '' ? undefined : updateToken.trim()
        };

        return callKiwifyAdminApi(
          `/api/kfy/webhooks/${encodeURIComponent(updateId.trim())}`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
          },
          'Erro ao atualizar webhook.'
        );
      });
    },
    [parseTriggers, updateId, updateName, updateOperation, updateProducts, updateToken, updateTriggers, updateUrl]
  );

  const handleDelete = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (deleteId.trim() === '') {
        deleteOperation.reset();
        return;
      }
      await deleteOperation.run(() =>
        callKiwifyAdminApi(
          `/api/kfy/webhooks/${encodeURIComponent(deleteId.trim())}`,
          { method: 'DELETE' },
          'Erro ao deletar webhook.'
        )
      );
    },
    [deleteId, deleteOperation]
  );

  const triggersHint = useMemo(() => 'Ex.: sale.approved, sale.refunded', []);

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Webhooks</h1>
        <p className="mt-2 text-sm text-slate-600">
          Administre os webhooks configurados na Kiwify, criando novos endpoints ou ajustando integrações existentes.
        </p>
      </header>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Listar webhooks</CardTitle>
            <CardDescription>Visualize todos os webhooks cadastrados com filtros por produto ou termo de busca.</CardDescription>
          </CardHeader>
          <CardContent>
          <form className="space-y-4" onSubmit={handleList}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                ID do produto
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={productId}
                  onChange={event => setProductId(event.target.value)}
                  placeholder="all"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2 lg:col-span-3">
                Termo de busca
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Nome ou URL"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={listOperation.loading}>
                {listOperation.loading ? 'Consultando…' : 'Listar webhooks'}
              </Button>
              {!!listOperation.data && !listOperation.loading && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPageSize('');
                    setPage('');
                    setProductId('');
                    setSearch('');
                    listOperation.reset();
                  }}
                >
                  Limpar resultado
                </Button>
              )}
            </div>
          </form>
          <OperationResult loading={listOperation.loading} error={listOperation.error} data={listOperation.data} />
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <Card>
            <CardHeader>
            <CardTitle>Consultar webhook</CardTitle>
            <CardDescription>Recupere os detalhes de um webhook específico informando o ID cadastrado.</CardDescription>
            </CardHeader>
            <CardContent>
            <form className="space-y-4" onSubmit={handleDetail}>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                ID do webhook
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={detailId}
                  onChange={event => setDetailId(event.target.value)}
                  placeholder="wh_xxxxx"
                />
              </label>
              <Button type="submit" disabled={detailOperation.loading}>
                {detailOperation.loading ? 'Consultando…' : 'Consultar webhook'}
              </Button>
            </form>
            <OperationResult
              loading={detailOperation.loading}
              error={detailOperation.error}
              data={detailOperation.data}
            />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
            <CardTitle>Deletar webhook</CardTitle>
            <CardDescription>Remova definitivamente um webhook informando o identificador correspondente.</CardDescription>
            </CardHeader>
            <CardContent>
            <form className="space-y-4" onSubmit={handleDelete}>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                ID do webhook
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={deleteId}
                  onChange={event => setDeleteId(event.target.value)}
                  placeholder="wh_xxxxx"
                />
              </label>
              <Button type="submit" disabled={deleteOperation.loading}>
                {deleteOperation.loading ? 'Excluindo…' : 'Deletar webhook'}
              </Button>
            </form>
            <OperationResult
              loading={deleteOperation.loading}
              error={deleteOperation.error}
              data={deleteOperation.data}
            />
            </CardContent>
          </Card>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Criar webhook</CardTitle>
              <CardDescription>Cadastre um novo destino informando nome, URL, eventos suportados e produto desejado.</CardDescription>
            </CardHeader>
            <CardContent>
            <form className="space-y-4" onSubmit={handleCreate}>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Nome
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={createName}
                  onChange={event => setCreateName(event.target.value)}
                  placeholder="Webhook principal"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                URL
                <input
                  type="url"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={createUrl}
                  onChange={event => setCreateUrl(event.target.value)}
                  placeholder="https://example.com/webhook"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Produtos (all ou ID específico)
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={createProducts}
                  onChange={event => setCreateProducts(event.target.value)}
                  placeholder="all"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Triggers (separados por vírgula)
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={createTriggers}
                  onChange={event => setCreateTriggers(event.target.value)}
                  placeholder={triggersHint}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Token personalizado (opcional)
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={createToken}
                  onChange={event => setCreateToken(event.target.value)}
                />
              </label>
              <Button type="submit" disabled={createOperation.loading}>
                {createOperation.loading ? 'Criando…' : 'Criar webhook'}
              </Button>
            </form>
            <OperationResult
              loading={createOperation.loading}
              error={createOperation.error}
              data={createOperation.data}
            />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Atualizar webhook</CardTitle>
              <CardDescription>Aplique alterações em um webhook existente, mantendo as assinaturas atualizadas.</CardDescription>
            </CardHeader>
            <CardContent>
            <form className="space-y-4" onSubmit={handleUpdate}>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                ID do webhook
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={updateId}
                  onChange={event => setUpdateId(event.target.value)}
                  placeholder="wh_xxxxx"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Nome
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={updateName}
                  onChange={event => setUpdateName(event.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                URL
                <input
                  type="url"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={updateUrl}
                  onChange={event => setUpdateUrl(event.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Produtos (all ou ID específico)
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={updateProducts}
                  onChange={event => setUpdateProducts(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Triggers (separados por vírgula)
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={updateTriggers}
                  onChange={event => setUpdateTriggers(event.target.value)}
                  placeholder={triggersHint}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Token personalizado (opcional)
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={updateToken}
                  onChange={event => setUpdateToken(event.target.value)}
                />
              </label>
              <Button type="submit" disabled={updateOperation.loading}>
                {updateOperation.loading ? 'Salvando…' : 'Atualizar webhook'}
              </Button>
            </form>
            <OperationResult
              loading={updateOperation.loading}
              error={updateOperation.error}
              data={updateOperation.data}
            />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
