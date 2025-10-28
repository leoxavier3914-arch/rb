'use client';

import { FormEvent, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OperationResult } from '@/components/ui/operation-result';
import { callKiwifyAdminApi } from '@/lib/ui/kiwifyAdminApi';
import { useOperation } from '@/lib/ui/useOperation';

export default function SalesPage() {
  const listOperation = useOperation<unknown>();
  const detailsOperation = useOperation<unknown>();
  const refundOperation = useOperation<unknown>();
  const statsOperation = useOperation<unknown>();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [productId, setProductId] = useState('');
  const [pageSize, setPageSize] = useState('');
  const [page, setPage] = useState('');
  const [fullDetails, setFullDetails] = useState(false);

  const [detailSaleId, setDetailSaleId] = useState('');
  const [refundSaleId, setRefundSaleId] = useState('');
  const [refundPixKey, setRefundPixKey] = useState('');

  const [statsStartDate, setStatsStartDate] = useState('');
  const [statsEndDate, setStatsEndDate] = useState('');
  const [statsProductId, setStatsProductId] = useState('');

  const handleListSales = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (startDate.trim() === '' || endDate.trim() === '') {
        listOperation.reset();
        return;
      }

      const search = new URLSearchParams();
      search.set('start_date', startDate);
      search.set('end_date', endDate);
      if (status.trim() !== '') {
        search.set('status', status.trim());
      }
      if (paymentMethod.trim() !== '') {
        search.set('payment_method', paymentMethod.trim());
      }
      if (productId.trim() !== '') {
        search.set('product_id', productId.trim());
      }
      if (fullDetails) {
        search.set('full_details', 'true');
      }
      if (pageSize.trim() !== '') {
        search.set('page_size', pageSize.trim());
      }
      if (page.trim() !== '') {
        search.set('page', page.trim());
      }

      await listOperation.run(() =>
        callKiwifyAdminApi(`/api/kfy/sales?${search.toString()}`, {}, 'Erro ao listar vendas.')
      );
    },
    [endDate, fullDetails, listOperation, page, pageSize, paymentMethod, productId, startDate, status]
  );

  const handleSaleDetails = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (detailSaleId.trim() === '') {
        detailsOperation.reset();
        return;
      }

      await detailsOperation.run(() =>
        callKiwifyAdminApi(
          `/api/kfy/sales/${encodeURIComponent(detailSaleId.trim())}`,
          {},
          'Erro ao consultar venda.'
        )
      );
    },
    [detailSaleId, detailsOperation]
  );

  const handleRefund = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (refundSaleId.trim() === '') {
        refundOperation.reset();
        return;
      }

      await refundOperation.run(async () => {
        const result = await callKiwifyAdminApi(
          `/api/kfy/sales/${encodeURIComponent(refundSaleId.trim())}/refund`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(refundPixKey.trim() === '' ? {} : { pix_key: refundPixKey.trim() })
          },
          'Erro ao reembolsar venda.'
        );
        return result ?? { success: true };
      });
    },
    [refundOperation, refundPixKey, refundSaleId]
  );

  const handleStats = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (statsStartDate.trim() === '' || statsEndDate.trim() === '') {
        statsOperation.reset();
        return;
      }

      const search = new URLSearchParams();
      search.set('start_date', statsStartDate);
      search.set('end_date', statsEndDate);
      if (statsProductId.trim() !== '') {
        search.set('product_id', statsProductId.trim());
      }

      await statsOperation.run(() =>
        callKiwifyAdminApi(`/api/kfy/sales/stats?${search.toString()}`, {}, 'Erro ao consultar estatísticas.')
      );
    },
    [statsEndDate, statsOperation, statsProductId, statsStartDate]
  );

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Vendas</h1>
        <p className="mt-2 text-sm text-slate-600">
          Consulte transações, detalhes completos, reembolsos e estatísticas diretamente da API pública da Kiwify.
        </p>
      </header>

      <section>
        <Card>
          <CardHeader>
          <CardTitle>Listar vendas</CardTitle>
          <CardDescription>
            Informe o intervalo obrigatório de datas e, opcionalmente, utilize filtros adicionais para refinar o resultado.
          </CardDescription>
          </CardHeader>
          <CardContent>
          <form className="space-y-4" onSubmit={handleListSales}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Data de início
                <input
                  type="date"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={startDate}
                  onChange={event => setStartDate(event.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Data de fim
                <input
                  type="date"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={endDate}
                  onChange={event => setEndDate(event.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Status
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={status}
                  onChange={event => setStatus(event.target.value)}
                  placeholder="approved"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Método de pagamento
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={paymentMethod}
                  onChange={event => setPaymentMethod(event.target.value)}
                  placeholder="credit_card"
                />
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
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Tamanho da página
                <input
                  type="number"
                  min={1}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={pageSize}
                  onChange={event => setPageSize(event.target.value)}
                  placeholder="20"
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
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-slate-300"
                  checked={fullDetails}
                  onChange={event => setFullDetails(event.target.checked)}
                />
                Retornar detalhes completos
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={listOperation.loading}>
                {listOperation.loading ? 'Consultando…' : 'Listar vendas'}
              </Button>
              {!!listOperation.data && !listOperation.loading && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStatus('');
                    setPaymentMethod('');
                    setProductId('');
                    setPageSize('');
                    setPage('');
                    setFullDetails(false);
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
            <CardTitle>Consultar venda</CardTitle>
            <CardDescription>Busque uma venda específica enviando o ID retornado nas listagens.</CardDescription>
            </CardHeader>
            <CardContent>
            <form className="space-y-4" onSubmit={handleSaleDetails}>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                ID da venda
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={detailSaleId}
                  onChange={event => setDetailSaleId(event.target.value)}
                  placeholder="sale_xxxxx"
                />
              </label>
              <Button type="submit" disabled={detailsOperation.loading}>
                {detailsOperation.loading ? 'Consultando…' : 'Consultar venda'}
              </Button>
            </form>
            <OperationResult
              loading={detailsOperation.loading}
              error={detailsOperation.error}
              data={detailsOperation.data}
            />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
            <CardTitle>Reembolsar venda</CardTitle>
            <CardDescription>
              Informe o ID da venda e, se necessário, a chave PIX que deve ser utilizada no processo de estorno.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <form className="space-y-4" onSubmit={handleRefund}>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                ID da venda
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={refundSaleId}
                  onChange={event => setRefundSaleId(event.target.value)}
                  placeholder="sale_xxxxx"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Chave PIX (opcional)
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={refundPixKey}
                  onChange={event => setRefundPixKey(event.target.value)}
                  placeholder="pix@cliente.com"
                />
              </label>
              <Button type="submit" disabled={refundOperation.loading}>
                {refundOperation.loading ? 'Processando…' : 'Reembolsar venda'}
              </Button>
            </form>
            <OperationResult
              loading={refundOperation.loading}
              error={refundOperation.error}
              data={refundOperation.data}
            />
            </CardContent>
          </Card>
        </section>
      </div>

      <section>
        <Card>
          <CardHeader>
          <CardTitle>Consultar estatísticas de vendas</CardTitle>
          <CardDescription>
            Resuma o desempenho das vendas dentro de um período específico e, se desejar, limite a um produto.
          </CardDescription>
          </CardHeader>
          <CardContent>
          <form className="space-y-4" onSubmit={handleStats}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Data de início
                <input
                  type="date"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={statsStartDate}
                  onChange={event => setStatsStartDate(event.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Data de fim
                <input
                  type="date"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={statsEndDate}
                  onChange={event => setStatsEndDate(event.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                ID do produto (opcional)
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={statsProductId}
                  onChange={event => setStatsProductId(event.target.value)}
                  placeholder="prod_xxxxx"
                />
              </label>
            </div>
            <Button type="submit" disabled={statsOperation.loading}>
              {statsOperation.loading ? 'Consultando…' : 'Ver estatísticas'}
            </Button>
          </form>
          <OperationResult loading={statsOperation.loading} error={statsOperation.error} data={statsOperation.data} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
