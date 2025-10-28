'use client';

import { FormEvent, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OperationResult } from '@/components/ui/operation-result';
import { callKiwifyAdminApi } from '@/lib/ui/kiwifyAdminApi';
import { useOperation } from '@/lib/ui/useOperation';

export default function AffiliatesPage() {
  const listOperation = useOperation<unknown>();
  const detailOperation = useOperation<unknown>();
  const editOperation = useOperation<unknown>();

  const [pageSize, setPageSize] = useState('');
  const [page, setPage] = useState('');
  const [status, setStatus] = useState('');
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');

  const [detailId, setDetailId] = useState('');

  const [editId, setEditId] = useState('');
  const [editCommission, setEditCommission] = useState('');
  const [editStatus, setEditStatus] = useState('');

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
      if (status.trim() !== '') {
        params.set('status', status.trim());
      }
      if (productId.trim() !== '') {
        params.set('product_id', productId.trim());
      }
      if (search.trim() !== '') {
        params.set('search', search.trim());
      }

      await listOperation.run(() =>
        callKiwifyAdminApi(`/api/kfy/affiliates?${params.toString()}`, {}, 'Erro ao listar afiliados.')
      );
    },
    [listOperation, page, pageSize, productId, search, status]
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
          `/api/kfy/affiliates/${encodeURIComponent(detailId.trim())}`,
          {},
          'Erro ao consultar afiliado.'
        )
      );
    },
    [detailId, detailOperation]
  );

  const handleEdit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (editId.trim() === '') {
        editOperation.reset();
        return;
      }

      const body: Record<string, unknown> = {};
      if (editCommission.trim() !== '') {
        const parsed = Number(editCommission);
        if (!Number.isNaN(parsed)) {
          body.commission = parsed;
        }
      }
      if (editStatus.trim() !== '') {
        body.status = editStatus.trim();
      }

      await editOperation.run(() =>
        callKiwifyAdminApi(
          `/api/kfy/affiliates/${encodeURIComponent(editId.trim())}`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
          },
          'Erro ao editar afiliado.'
        )
      );
    },
    [editCommission, editId, editOperation, editStatus]
  );

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Afiliados</h1>
        <p className="mt-2 text-sm text-slate-600">
          Pesquise afiliados cadastrados, visualize detalhes individuais e ajuste comissões ou status conforme necessário.
        </p>
      </header>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Listar afiliados</CardTitle>
            <CardDescription>Aplique filtros de página, status, produto ou termos de busca para refinar os resultados.</CardDescription>
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
                Status
                <select
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={status}
                  onChange={event => setStatus(event.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="active">Ativo</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="rejected">Recusado</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                ID do produto
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={productId}
                  onChange={event => setProductId(event.target.value)}
                  placeholder="prod_xxxxx"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2 lg:col-span-3">
                Termo de busca
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Nome ou email"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={listOperation.loading}>
                {listOperation.loading ? 'Consultando…' : 'Listar afiliados'}
              </Button>
              {!!listOperation.data && !listOperation.loading && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPageSize('');
                    setPage('');
                    setStatus('');
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Consultar afiliado</CardTitle>
              <CardDescription>Recupere todos os dados de um afiliado específico informando o seu ID único.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleDetail}>
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  ID do afiliado
                  <input
                    type="text"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    value={detailId}
                    onChange={event => setDetailId(event.target.value)}
                    placeholder="aff_xxxxx"
                  />
                </label>
                <Button type="submit" disabled={detailOperation.loading}>
                  {detailOperation.loading ? 'Consultando…' : 'Consultar afiliado'}
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
              <CardTitle>Editar afiliado</CardTitle>
              <CardDescription>Atualize a comissão ou o status de um afiliado previamente aprovado.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleEdit}>
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  ID do afiliado
                  <input
                    type="text"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    value={editId}
                    onChange={event => setEditId(event.target.value)}
                    placeholder="aff_xxxxx"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  Comissão (%)
                  <input
                    type="number"
                    step="0.01"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    value={editCommission}
                    onChange={event => setEditCommission(event.target.value)}
                    placeholder="25"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  Status
                  <select
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    value={editStatus}
                    onChange={event => setEditStatus(event.target.value)}
                  >
                    <option value="">Sem alteração</option>
                    <option value="active">Ativo</option>
                    <option value="blocked">Bloqueado</option>
                    <option value="rejected">Recusado</option>
                  </select>
                </label>
                <Button type="submit" disabled={editOperation.loading}>
                  {editOperation.loading ? 'Salvando…' : 'Salvar alterações'}
                </Button>
              </form>
              <OperationResult loading={editOperation.loading} error={editOperation.error} data={editOperation.data} />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
