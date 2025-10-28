'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OperationResult } from '@/components/ui/operation-result';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/Skeletons';
import { cn } from '@/lib/ui/classnames';
import { formatMoneyFromCents, formatShortDate } from '@/lib/ui/format';
import { callKiwifyAdminApi } from '@/lib/ui/kiwifyAdminApi';
import { useOperation } from '@/lib/ui/useOperation';

const MAX_SALES_RANGE_DAYS = 90;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 20;

type UnknownRecord = Record<string, unknown>;

interface SaleListItem {
  readonly id: string;
  readonly status: string;
  readonly totalCents: number;
  readonly createdAt: string | null;
  readonly customer: string;
}

interface SaleDetail {
  readonly id: string;
  readonly status: string | null;
  readonly totalCents: number;
  readonly netCents: number | null;
  readonly feeCents: number | null;
  readonly customerId: string | null;
  readonly productId: string | null;
  readonly createdAt: string | null;
  readonly paidAt: string | null;
  readonly updatedAt: string | null;
  readonly raw: HubSaleDetailResponse;
}

interface SaleListFilters {
  readonly startDate: string;
  readonly endDate: string;
  readonly pageSize: number;
  readonly page: number;
}

interface HubSaleItem {
  readonly id: string;
  readonly customer: string;
  readonly status: string;
  readonly total_cents: number | null;
  readonly created_at: string | null;
}

interface HubSalesResponse extends UnknownRecord {
  readonly ok: true;
  readonly page: number;
  readonly page_size: number;
  readonly total: number | null;
  readonly items: readonly HubSaleItem[];
}

interface HubSaleRecord {
  readonly id: string;
  readonly status: string | null;
  readonly total_amount_cents: number | null;
  readonly net_amount_cents: number | null;
  readonly fee_amount_cents: number | null;
  readonly customer_id: string | null;
  readonly product_id: string | null;
  readonly created_at: string | null;
  readonly paid_at: string | null;
  readonly updated_at: string | null;
}

interface HubSaleDetailResponse extends UnknownRecord {
  readonly ok: true;
  readonly sale: HubSaleRecord | null;
  readonly events: readonly UnknownRecord[];
  readonly notes: readonly UnknownRecord[];
  readonly versions: readonly UnknownRecord[];
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildAdminHeaders(initHeaders: HeadersInit | undefined): Record<string, string> {
  const headers = new Headers(initHeaders);
  headers.set('x-admin-role', 'true');
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function extractError(payload: UnknownRecord, fallbackMessage: string): string {
  const message = typeof payload.error === 'string' ? payload.error.trim() : '';
  return message !== '' ? message : fallbackMessage;
}

async function callAdminEndpoint(
  url: string,
  options: RequestInit = {},
  fallbackMessage = 'Erro ao executar operação.'
): Promise<UnknownRecord> {
  const response = await fetch(url, {
    ...options,
    headers: buildAdminHeaders(options.headers)
  });

  if (response.status === 204 || response.status === 205) {
    return {};
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    throw new Error(fallbackMessage);
  }

  if (!response.ok || payload.ok === false) {
    throw new Error(extractError(payload, fallbackMessage));
  }

  return payload;
}

function isHubSaleItem(value: unknown): value is HubSaleItem {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.customer === 'string' &&
    typeof value.status === 'string' &&
    (value.total_cents === null || typeof value.total_cents === 'number') &&
    (value.created_at === null || typeof value.created_at === 'string')
  );
}

function isHubSalesResponse(value: unknown): value is HubSalesResponse {
  return (
    isRecord(value) &&
    value.ok === true &&
    typeof value.page === 'number' &&
    typeof value.page_size === 'number' &&
    (value.total === null || typeof value.total === 'number') &&
    Array.isArray(value.items) &&
    value.items.every(isHubSaleItem)
  );
}

function isHubSaleRecord(value: unknown): value is HubSaleRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.status === null || typeof value.status === 'string') &&
    (value.total_amount_cents === null || typeof value.total_amount_cents === 'number') &&
    (value.net_amount_cents === null || typeof value.net_amount_cents === 'number') &&
    (value.fee_amount_cents === null || typeof value.fee_amount_cents === 'number') &&
    (value.customer_id === null || typeof value.customer_id === 'string') &&
    (value.product_id === null || typeof value.product_id === 'string') &&
    (value.created_at === null || typeof value.created_at === 'string') &&
    (value.paid_at === null || typeof value.paid_at === 'string') &&
    (value.updated_at === null || typeof value.updated_at === 'string')
  );
}

function isHubSaleDetailResponse(value: unknown): value is HubSaleDetailResponse {
  return (
    isRecord(value) &&
    value.ok === true &&
    (value.sale === null || isHubSaleRecord(value.sale)) &&
    Array.isArray(value.events) &&
    Array.isArray(value.notes) &&
    Array.isArray(value.versions)
  );
}

function mapSaleListItem(item: HubSaleItem): SaleListItem {
  return {
    id: item.id,
    status: item.status,
    totalCents: item.total_cents ?? 0,
    createdAt: item.created_at ?? null,
    customer: item.customer
  };
}

function mapSaleDetail(response: HubSaleDetailResponse | null): SaleDetail | null {
  if (!response || !response.sale) {
    return null;
  }

  const sale = response.sale;
  return {
    id: sale.id,
    status: sale.status,
    totalCents: sale.total_amount_cents ?? 0,
    netCents: sale.net_amount_cents ?? null,
    feeCents: sale.fee_amount_cents ?? null,
    customerId: sale.customer_id ?? null,
    productId: sale.product_id ?? null,
    createdAt: sale.created_at ?? null,
    paidAt: sale.paid_at ?? null,
    updatedAt: sale.updated_at ?? null,
    raw: response
  };
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function SalesPage() {
  const listOperation = useOperation<HubSalesResponse>();
  const detailsOperation = useOperation<HubSaleDetailResponse>();
  const syncOperation = useOperation<UnknownRecord>();
  const refundOperation = useOperation<unknown>();
  const statsOperation = useOperation<unknown>();

  const runListOperation = listOperation.run;
  const runDetailsOperation = detailsOperation.run;
  const resetDetailsOperation = detailsOperation.reset;
  const runSyncOperation = syncOperation.run;
  const runRefundOperation = refundOperation.run;
  const resetRefundOperation = refundOperation.reset;
  const runStatsOperation = statsOperation.run;
  const resetStatsOperation = statsOperation.reset;

  const defaultEndDate = useMemo(() => formatDateInput(new Date()), []);
  const defaultStartDate = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (MAX_SALES_RANGE_DAYS - 1) * MILLISECONDS_PER_DAY);
    return formatDateInput(startDate);
  }, []);

  const [page, setPage] = useState(1);
  const [detailSaleId, setDetailSaleId] = useState('');
  const [refundSaleId, setRefundSaleId] = useState('');
  const [refundPixKey, setRefundPixKey] = useState('');
  const [statsStartDate, setStatsStartDate] = useState('');
  const [statsEndDate, setStatsEndDate] = useState('');
  const [statsProductId, setStatsProductId] = useState('');

  const runListSales = useCallback(
    async (currentFilters: SaleListFilters) => {
      await runListOperation(async () => {
        const search = new URLSearchParams();
        search.set('date_from', currentFilters.startDate);
        search.set('date_to', currentFilters.endDate);
        search.set('page_size', String(currentFilters.pageSize));
        search.set('page', String(currentFilters.page));

        const payload = await callAdminEndpoint(
          `/api/hub/sales?${search.toString()}`,
          {},
          'Erro ao listar vendas.'
        );
        if (!isHubSalesResponse(payload)) {
          throw new Error('Erro ao listar vendas.');
        }
        return payload;
      });
    },
    [runListOperation]
  );

  useEffect(() => {
    void runListSales({
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      pageSize: DEFAULT_PAGE_SIZE,
      page
    });
  }, [defaultEndDate, defaultStartDate, page, runListSales]);

  const sales = useMemo(() => {
    return listOperation.data ? listOperation.data.items.map(mapSaleListItem) : [];
  }, [listOperation.data]);

  const saleDetail = useMemo(() => mapSaleDetail(detailsOperation.data), [detailsOperation.data]);
  const totalCount = listOperation.data?.total ?? null;
  const currentPage = listOperation.data?.page ?? page;
  const currentPageSize = listOperation.data?.page_size ?? DEFAULT_PAGE_SIZE;
  const totalPages = totalCount !== null ? Math.max(1, Math.ceil(totalCount / currentPageSize)) : null;
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = totalCount !== null ? currentPage * currentPageSize < totalCount : sales.length === currentPageSize;

  const handlePreviousPage = useCallback(() => {
    if (hasPreviousPage) {
      setPage(previous => Math.max(1, previous - 1));
    }
  }, [hasPreviousPage]);

  const handleNextPage = useCallback(() => {
    if (hasNextPage) {
      setPage(previous => previous + 1);
    }
  }, [hasNextPage]);

  const runSaleDetails = useCallback(
    async (saleId: string) => {
      const normalized = saleId.trim();
      if (normalized === '') {
        resetDetailsOperation();
        return;
      }
      await runDetailsOperation(async () => {
        const payload = await callAdminEndpoint(
          `/api/hub/sales/${encodeURIComponent(normalized)}`,
          {},
          'Erro ao consultar venda.'
        );
        if (!isHubSaleDetailResponse(payload)) {
          throw new Error('Erro ao consultar venda.');
        }
        return payload;
      });
    },
    [resetDetailsOperation, runDetailsOperation]
  );

  const handleSaleDetails = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalized = detailSaleId.trim();
      setDetailSaleId(normalized);
      await runSaleDetails(normalized);
    },
    [detailSaleId, runSaleDetails]
  );

  const handleSelectSale = useCallback(
    (saleId: string) => {
      setDetailSaleId(saleId);
      void runSaleDetails(saleId);
    },
    [runSaleDetails]
  );

  const handleSync = useCallback(async () => {
    await runSyncOperation(() =>
      callAdminEndpoint(
        '/api/kfy/sync',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ resources: ['sales'], persist: true })
        },
        'Erro ao sincronizar vendas.'
      )
    );
    const baseFilters: SaleListFilters = {
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      pageSize: DEFAULT_PAGE_SIZE,
      page: 1
    };
    await runListSales(baseFilters);
    setPage(1);
  }, [defaultEndDate, defaultStartDate, runListSales, runSyncOperation]);

  const handleRefund = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (refundSaleId.trim() === '') {
        resetRefundOperation();
        return;
      }

      await runRefundOperation(async () => {
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
    [refundPixKey, refundSaleId, resetRefundOperation, runRefundOperation]
  );

  const handleStats = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (statsStartDate.trim() === '' || statsEndDate.trim() === '') {
        resetStatsOperation();
        return;
      }

      const search = new URLSearchParams();
      search.set('start_date', statsStartDate);
      search.set('end_date', statsEndDate);
      if (statsProductId.trim() !== '') {
        search.set('product_id', statsProductId.trim());
      }

      await runStatsOperation(() =>
        callKiwifyAdminApi(
          `/api/hub/sales/stats?${search.toString()}`,
          {},
          'Erro ao consultar estatísticas.'
        )
      );
    },
    [resetStatsOperation, runStatsOperation, statsEndDate, statsProductId, statsStartDate]
  );

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Vendas</h1>
        <p className="mt-2 text-sm text-slate-600">
          Trabalhe com as vendas sincronizadas no Supabase e utilize a API oficial da Kiwify apenas para ações manuais, como
          reembolsos ou atualizações emergenciais.
        </p>
      </header>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Lista de vendas</CardTitle>
            <CardDescription>
              Vendas coletadas via sincronização e armazenadas no Supabase. Atualize manualmente antes de consultar, se
              necessário.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-slate-500">
                Intervalo padrão: {defaultStartDate} até {defaultEndDate}. Página {currentPage}
                {totalPages ? ` de ${totalPages}` : ''}.
              </p>
              <Button onClick={handleSync} disabled={syncOperation.loading}>
                {syncOperation.loading ? 'Sincronizando…' : 'Sincronizar vendas'}
              </Button>
            </div>

            <OperationResult
              loading={syncOperation.loading}
              error={syncOperation.error}
              data={syncOperation.data}
              className="mb-4"
            />

            {listOperation.loading ? (
              <TableSkeleton rows={6} />
            ) : listOperation.error ? (
              <p className="text-sm text-red-600">{listOperation.error}</p>
            ) : listOperation.data ? (
              sales.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-600">
                      {totalCount !== null
                        ? `Mostrando ${sales.length} de ${totalCount} vendas sincronizadas.`
                        : `${sales.length} ${sales.length === 1 ? 'venda sincronizada' : 'vendas sincronizadas'}.`}
                    </p>
                    <p className="text-xs text-slate-500">Clique em uma venda para ver os detalhes armazenados.</p>
                  </div>
                  <div className="overflow-hidden rounded-md border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[160px]">ID</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sales.map(sale => (
                          <TableRow
                            key={sale.id}
                            onClick={() => handleSelectSale(sale.id)}
                            className={cn(
                              'cursor-pointer transition-colors hover:bg-slate-50',
                              sale.id === detailSaleId ? 'bg-slate-100' : undefined
                            )}
                          >
                            <TableCell>
                              <span className="font-mono text-xs text-slate-600">{sale.id}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-slate-700">{sale.customer}</span>
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                                {sale.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium text-slate-900">
                              {formatMoneyFromCents(sale.totalCents)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-slate-600">
                              {sale.createdAt ? formatShortDate(sale.createdAt) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      Página {currentPage}
                      {totalPages ? ` de ${totalPages}` : ''} · {currentPageSize} itens por página.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreviousPage}
                        disabled={!hasPreviousPage || listOperation.loading}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={!hasNextPage || listOperation.loading}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600">Nenhuma venda sincronizada para o intervalo consultado.</p>
              )
            ) : (
              <p className="text-sm text-slate-500">As vendas serão carregadas automaticamente após a sincronização.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Consultar venda</CardTitle>
              <CardDescription>Busque uma venda específica a partir dos dados armazenados no Supabase.</CardDescription>
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
              <div className="mt-4 space-y-4">
                {detailsOperation.loading ? (
                  <p className="text-sm text-slate-500">Consultando venda…</p>
                ) : detailsOperation.error ? (
                  <p className="text-sm text-red-600">{detailsOperation.error}</p>
                ) : saleDetail ? (
                  <div className="space-y-4">
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                      <dl className="grid gap-4 text-sm text-slate-700 sm:grid-cols-2">
                        <div className="space-y-1">
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">ID</dt>
                          <dd className="font-mono text-xs text-slate-700">{saleDetail.id}</dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</dt>
                          <dd className="capitalize">{saleDetail.status ?? 'desconhecido'}</dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Total bruto</dt>
                          <dd className="font-medium text-slate-900">{formatMoneyFromCents(saleDetail.totalCents)}</dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Total líquido</dt>
                          <dd className="font-medium text-slate-900">
                            {saleDetail.netCents !== null ? formatMoneyFromCents(saleDetail.netCents) : '—'}
                          </dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Taxas</dt>
                          <dd className="font-medium text-slate-900">
                            {saleDetail.feeCents !== null ? formatMoneyFromCents(saleDetail.feeCents) : '—'}
                          </dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Cliente</dt>
                          <dd className="font-mono text-xs text-slate-700">{saleDetail.customerId ?? '—'}</dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Produto</dt>
                          <dd className="font-mono text-xs text-slate-700">{saleDetail.productId ?? '—'}</dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Criada em</dt>
                          <dd>{saleDetail.createdAt ? formatShortDate(saleDetail.createdAt) : '—'}</dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Pago em</dt>
                          <dd>{saleDetail.paidAt ? formatShortDate(saleDetail.paidAt) : '—'}</dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Atualizado em</dt>
                          <dd>{saleDetail.updatedAt ? formatShortDate(saleDetail.updatedAt) : '—'}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Resposta completa</p>
                      <pre className="mt-2 max-h-80 overflow-y-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
                        {formatJson(saleDetail.raw)}
                      </pre>
                    </div>
                  </div>
                ) : detailsOperation.data ? (
                  <pre className="max-h-80 overflow-y-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
                    {formatJson(detailsOperation.data)}
                  </pre>
                ) : (
                  <p className="text-sm text-slate-500">
                    Selecione uma venda na tabela acima ou informe o identificador para consultar os detalhes.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Reembolsar venda</CardTitle>
              <CardDescription>
                Informe o ID da venda e, se necessário, a chave PIX que deve ser utilizada no processo de estorno direto na Kiwify.
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
              Resuma o desempenho das vendas a partir dos registros armazenados no Supabase e, se desejar, limite a um produto.
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
