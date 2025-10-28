'use client';

import { FormEvent, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OperationResult } from '@/components/ui/operation-result';
import { callKiwifyAdminApi } from '@/lib/ui/kiwifyAdminApi';
import { useOperation } from '@/lib/ui/useOperation';

export default function EventsPage() {
  const participantsOperation = useOperation<unknown>();

  const [productId, setProductId] = useState('');
  const [checkedIn, setCheckedIn] = useState<'all' | 'true' | 'false'>('all');
  const [pageSize, setPageSize] = useState('');
  const [page, setPage] = useState('');
  const [createdStart, setCreatedStart] = useState('');
  const [createdEnd, setCreatedEnd] = useState('');
  const [updatedStart, setUpdatedStart] = useState('');
  const [updatedEnd, setUpdatedEnd] = useState('');
  const [externalId, setExternalId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [orderId, setOrderId] = useState('');

  const handleListParticipants = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (productId.trim() === '') {
        participantsOperation.reset();
        return;
      }

      const params = new URLSearchParams();
      params.set('product_id', productId.trim());
      if (checkedIn !== 'all') {
        params.set('checked_in', checkedIn);
      }
      if (pageSize.trim() !== '') {
        params.set('page_size', pageSize.trim());
      }
      if (page.trim() !== '') {
        params.set('page', page.trim());
      }
      if (createdStart.trim() !== '') {
        params.set('created_at_start', createdStart.trim());
      }
      if (createdEnd.trim() !== '') {
        params.set('created_at_end', createdEnd.trim());
      }
      if (updatedStart.trim() !== '') {
        params.set('updated_at_start', updatedStart.trim());
      }
      if (updatedEnd.trim() !== '') {
        params.set('updated_at_end', updatedEnd.trim());
      }
      if (externalId.trim() !== '') {
        params.set('external_id', externalId.trim());
      }
      if (batchId.trim() !== '') {
        params.set('batch_id', batchId.trim());
      }
      if (phone.trim() !== '') {
        params.set('phone', phone.trim());
      }
      if (cpf.trim() !== '') {
        params.set('cpf', cpf.trim());
      }
      if (orderId.trim() !== '') {
        params.set('order_id', orderId.trim());
      }

      await participantsOperation.run(() =>
        callKiwifyAdminApi(
          `/api/kfy/events/participants?${params.toString()}`,
          {},
          'Erro ao listar participantes.'
        )
      );
    },
    [batchId, checkedIn, cpf, createdEnd, createdStart, externalId, orderId, page, pageSize, participantsOperation, phone, productId, updatedEnd, updatedStart]
  );

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Eventos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Consulte os participantes dos eventos vinculados aos seus produtos, aplicando filtros avançados de data e status.
        </p>
      </header>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Listar participantes</CardTitle>
            <CardDescription>Informe o produto do evento e refine a consulta com filtros adicionais, incluindo check-in.</CardDescription>
          </CardHeader>
          <CardContent>
          <form className="space-y-4" onSubmit={handleListParticipants}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                ID do produto
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={productId}
                  onChange={event => setProductId(event.target.value)}
                  placeholder="prod_xxxxx"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Check-in realizado
                <select
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={checkedIn}
                  onChange={event => setCheckedIn(event.target.value as 'all' | 'true' | 'false')}
                >
                  <option value="all">Todos</option>
                  <option value="true">Somente check-in confirmado</option>
                  <option value="false">Somente sem check-in</option>
                </select>
              </label>
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
                Criação - início
                <input
                  type="date"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={createdStart}
                  onChange={event => setCreatedStart(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Criação - fim
                <input
                  type="date"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={createdEnd}
                  onChange={event => setCreatedEnd(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Atualização - início
                <input
                  type="date"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={updatedStart}
                  onChange={event => setUpdatedStart(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Atualização - fim
                <input
                  type="date"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={updatedEnd}
                  onChange={event => setUpdatedEnd(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                External ID
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={externalId}
                  onChange={event => setExternalId(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Batch ID
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={batchId}
                  onChange={event => setBatchId(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Telefone
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                CPF
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={cpf}
                  onChange={event => setCpf(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                ID do pedido
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={orderId}
                  onChange={event => setOrderId(event.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={participantsOperation.loading}>
                {participantsOperation.loading ? 'Consultando…' : 'Listar participantes'}
              </Button>
              {!!participantsOperation.data && !participantsOperation.loading && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPageSize('');
                    setPage('');
                    setCheckedIn('all');
                    setCreatedStart('');
                    setCreatedEnd('');
                    setUpdatedStart('');
                    setUpdatedEnd('');
                    setExternalId('');
                    setBatchId('');
                    setPhone('');
                    setCpf('');
                    setOrderId('');
                    participantsOperation.reset();
                  }}
                >
                  Limpar resultado
                </Button>
              )}
            </div>
          </form>
          <OperationResult
            loading={participantsOperation.loading}
            error={participantsOperation.error}
            data={participantsOperation.data}
          />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
