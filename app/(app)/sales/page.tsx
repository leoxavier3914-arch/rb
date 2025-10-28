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

type UnknownRecord = Record<string, unknown>;

interface SaleListItem {
  readonly id: string;
  readonly status: string;
  readonly totalCents: number;
  readonly createdAt: string | null;
  readonly customer: string;
  readonly raw: UnknownRecord;
}

interface SaleDetail {
  readonly id: string;
  readonly status: string | null;
  readonly totalCents: number | null;
  readonly netCents: number | null;
  readonly feeCents: number | null;
  readonly customerId: string | null;
  readonly productId: string | null;
  readonly createdAt: string | null;
  readonly paidAt: string | null;
  readonly updatedAt: string | null;
  readonly raw: UnknownRecord;
}

interface SaleListFilters {
  readonly startDate: string;
  readonly endDate: string;
  readonly pageSize: number;
  readonly page: number;
}

const SALE_KEYS = ['sales', 'data', 'items', 'results', 'orders', 'list', 'values', 'entries'] as const;
const SALE_ID_KEYS = ['id', 'uuid', 'sale_id', 'saleId', 'order_id', 'orderId'] as const;
const STATUS_KEYS = ['status', 'state', 'situation'] as const;
const TOTAL_KEYS = [
  'total_amount_cents',
  'total_amount',
  'amount_cents',
  'amount',
  'total',
  'value',
  'price'
] as const;
const DATE_KEYS = [
  'paid_at',
  'paidAt',
  'approved_at',
  'approvedAt',
  'completed_at',
  'completedAt',
  'created_at',
  'createdAt',
  'inserted_at',
  'insertedAt',
  'date',
  'purchased_at',
  'purchasedAt',
  'updated_at',
  'updatedAt'
] as const;
const MAX_SALES_RANGE_DAYS = 90;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const CUSTOMER_KEYS = [
  'customer',
  'customer_name',
  'customerName',
  'customer_full_name',
  'customerFullName',
  'buyer',
  'buyer_name',
  'buyerName',
  'client',
  'client_name',
  'clientName'
] as const;
const CUSTOMER_STRING_KEYS = [
  'customer',
  'customer_name',
  'customerName',
  'customer_full_name',
  'customerFullName',
  'buyer',
  'buyer_name',
  'buyerName',
  'client',
  'client_name',
  'clientName',
  'customer_email',
  'customerEmail',
  'customer_document',
  'customerDocument',
  'email'
] as const;

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceId(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  return null;
}

function coerceString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  return null;
}

function coerceDate(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const raw = typeof value === 'string' ? value.trim() : value?.toString?.() ?? '';
  if (raw === '') {
    return null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toCents(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? value : Math.round(value * 100);
  }
  const numeric = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isNaN(numeric) ? 0 : Math.round(numeric * 100);
}

function getValue(record: UnknownRecord, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (key in record) {
      const value = record[key];
      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }
  return undefined;
}

function extractSaleRecords(data: unknown): { readonly found: boolean; readonly items: UnknownRecord[] } {
  if (Array.isArray(data)) {
    return { found: true, items: data.filter(isRecord) };
  }
  if (isRecord(data)) {
    for (const key of SALE_KEYS) {
      const nested = data[key];
      if (nested === undefined) {
        continue;
      }
      const result = extractSaleRecords(nested);
      if (result.found) {
        return result;
      }
    }
  }
  return { found: false, items: [] };
}

function resolveCustomerName(record: UnknownRecord): string {
  const directValue = getValue(record, CUSTOMER_STRING_KEYS);
  const direct = coerceString(directValue);
  if (direct) {
    return direct;
  }

  for (const key of CUSTOMER_KEYS) {
    const nested = record[key];
    if (!isRecord(nested)) {
      continue;
    }
    const nestedName =
      coerceString(getValue(nested, ['name', 'full_name', 'fullName', 'display_name', 'displayName'])) ??
      coerceString(getValue(nested, ['email', 'document']));
    if (nestedName) {
      return nestedName;
    }
  }

  const fallback =
    coerceString(record['customer_email']) ??
    coerceString(record['customerEmail']) ??
    coerceString(record['email']) ??
    null;

  return fallback ?? 'Cliente desconhecido';
}

function mapSaleListItem(record: UnknownRecord): SaleListItem | null {
  const idValue = getValue(record, SALE_ID_KEYS);
  const id = coerceId(idValue);
  if (!id) {
    return null;
  }

  const statusValue = getValue(record, STATUS_KEYS);
  const status = coerceString(statusValue) ?? 'desconhecido';
  const totalValue = getValue(record, TOTAL_KEYS);
  const totalCents = toCents(totalValue);
  const dateValue = getValue(record, DATE_KEYS);
  const createdAt = coerceDate(dateValue);
  const customer = resolveCustomerName(record);

  return { id, status, totalCents, createdAt, customer, raw: record };
}

function mapSaleDetail(record: UnknownRecord): SaleDetail | null {
  const idValue = getValue(record, SALE_ID_KEYS);
  const id = coerceId(idValue);
  if (!id) {
    return null;
  }

  const status = coerceString(getValue(record, STATUS_KEYS));
  const totalCents = toCents(getValue(record, TOTAL_KEYS));
  const netCents = record['net_amount_cents'] ?? record['net_amount'] ?? record['net'] ?? null;
  const feeCents = record['fee_amount_cents'] ?? record['fee_amount'] ?? record['fees'] ?? null;
  const customerId = coerceString(
    getValue(record, ['customer_id', 'customerId', 'client_id', 'clientId']) ??
      (isRecord(record['customer']) ? getValue(record['customer'], ['id', 'uuid']) : undefined)
  );
  const productId = coerceString(getValue(record, ['product_id', 'productId']));
  const createdAt = coerceDate(getValue(record, ['created_at', 'createdAt', 'inserted_at', 'insertedAt']));
  const paidAt = coerceDate(getValue(record, ['paid_at', 'paidAt', 'approved_at', 'approvedAt']));
  const updatedAt = coerceDate(getValue(record, ['updated_at', 'updatedAt']));

  const normalizeCents = (value: unknown): number | null => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Number.isInteger(value) ? value : Math.round(value * 100);
    }
    const numeric = Number.parseFloat(String(value).replace(',', '.'));
    return Number.isNaN(numeric) ? null : Math.round(numeric * 100);
  };

  return {
    id,
    status,
    totalCents,
    netCents: normalizeCents(netCents),
    feeCents: normalizeCents(feeCents),
    customerId,
    productId,
    createdAt,
    paidAt,
    updatedAt,
    raw: record
  };
}

function extractTotalCount(data: unknown): number | null {
  if (typeof data === 'number' && Number.isFinite(data)) {
    return Math.max(0, Math.round(data));
  }
  if (isRecord(data)) {
    const direct = getValue(data, ['total', 'total_count', 'totalCount', 'count']);
    if (typeof direct === 'number' && Number.isFinite(direct)) {
      return Math.max(0, Math.round(direct));
    }
    if (typeof direct === 'string' && direct.trim() !== '') {
      const parsed = Number.parseInt(direct.trim(), 10);
      if (!Number.isNaN(parsed)) {
        return Math.max(0, parsed);
      }
    }
    const pagination = data.pagination ?? data.meta ?? null;
    const nested = extractTotalCount(pagination);
    if (nested !== null) {
      return nested;
    }
  }
  return null;
}

function notNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function SalesPage() {
  const listOperation = useOperation<unknown>();
  const detailsOperation = useOperation<unknown>();
  const refundOperation = useOperation<unknown>();
  const statsOperation = useOperation<unknown>();

  const runListOperation = listOperation.run;
  const runDetailsOperation = detailsOperation.run;
  const resetDetailsOperation = detailsOperation.reset;
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

  const [detailSaleId, setDetailSaleId] = useState('');
  const [refundSaleId, setRefundSaleId] = useState('');
  const [refundPixKey, setRefundPixKey] = useState('');

  const [statsStartDate, setStatsStartDate] = useState('');
  const [statsEndDate, setStatsEndDate] = useState('');
  const [statsProductId, setStatsProductId] = useState('');

  const [filters, setFilters] = useState<SaleListFilters>(() => ({
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    pageSize: 10,
    page: 1
  }));

  const saleExtraction = useMemo(() => extractSaleRecords(listOperation.data), [listOperation.data]);
  const sales = useMemo(
    () => saleExtraction.items.map(mapSaleListItem).filter(notNull),
    [saleExtraction]
  );
  const totalCount = useMemo(() => extractTotalCount(listOperation.data), [listOperation.data]);
  const totalPages = useMemo(() => {
    if (totalCount === null) {
      return null;
    }
    return Math.max(1, Math.ceil(totalCount / filters.pageSize));
  }, [filters.pageSize, totalCount]);
  const saleDetail = useMemo(() => {
    if (!detailsOperation.data || !isRecord(detailsOperation.data)) {
      return null;
    }
    return mapSaleDetail(detailsOperation.data);
  }, [detailsOperation.data]);

  const runListSales = useCallback(
    async (currentFilters: SaleListFilters) => {
      const search = new URLSearchParams();
      search.set('start_date', currentFilters.startDate);
      search.set('end_date', currentFilters.endDate);
      search.set('page_size', String(currentFilters.pageSize));
      search.set('page', String(currentFilters.page));

      await runListOperation(() =>
        callKiwifyAdminApi(`/api/kfy/sales?${search.toString()}`, {}, 'Erro ao listar vendas.')
      );
    },
    [runListOperation]
  );

  useEffect(() => {
    void runListSales(filters);
  }, [filters, runListSales]);

  const runSaleDetails = useCallback(
    async (saleId: string) => {
      const normalized = saleId.trim();
      if (normalized === '') {
        resetDetailsOperation();
        return;
      }
      await runDetailsOperation(() =>
        callKiwifyAdminApi(
          `/api/kfy/sales/${encodeURIComponent(normalized)}`,
          {},
          'Erro ao consultar venda.'
        )
      );
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

  const handlePreviousPage = useCallback(() => {
    setFilters(currentFilters => {
      const previousPage = Math.max(1, currentFilters.page - 1);
      if (previousPage === currentFilters.page) {
        return currentFilters;
      }
      return { ...currentFilters, page: previousPage };
    });
  }, []);

  const handleNextPage = useCallback(() => {
    setFilters(currentFilters => {
      const limit = totalPages ?? Infinity;
      const nextPage = Math.min(limit, currentFilters.page + 1);
      if (nextPage === currentFilters.page) {
        return currentFilters;
      }
      return { ...currentFilters, page: nextPage };
    });
  }, [totalPages]);

  const canGoPrevious = filters.page > 1;
  const canGoNext = useMemo(() => {
    if (totalPages !== null) {
      return filters.page < totalPages;
    }
    return sales.length === filters.pageSize;
  }, [filters.page, filters.pageSize, sales.length, totalPages]);

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
        callKiwifyAdminApi(`/api/kfy/sales/stats?${search.toString()}`, {}, 'Erro ao consultar estatísticas.')
      );
    },
    [resetStatsOperation, runStatsOperation, statsEndDate, statsProductId, statsStartDate]
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
            <CardTitle>Lista de vendas</CardTitle>
            <CardDescription>
              Todas as vendas retornadas pela API nos últimos 90 dias, até a data atual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {listOperation.loading ? (
              <TableSkeleton rows={6} />
            ) : listOperation.error ? (
              <p className="text-sm text-red-600">{listOperation.error}</p>
            ) : saleExtraction.found ? (
              sales.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-600">
                      {totalCount !== null
                        ? `Mostrando ${sales.length} de ${totalCount} vendas encontradas.`
                        : `${sales.length} ${sales.length === 1 ? 'venda encontrada' : 'vendas encontradas'}.`}
                    </p>
                    <p className="text-xs text-slate-500">Clique em uma venda para ver os detalhes.</p>
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">
                      Página {filters.page}
                      {totalPages !== null ? ` de ${totalPages}` : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handlePreviousPage}
                        disabled={!canGoPrevious || listOperation.loading}
                      >
                        Anterior
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={!canGoNext || listOperation.loading}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600">Nenhuma venda encontrada para o intervalo completo consultado.</p>
              )
            ) : listOperation.data ? (
              <pre className="max-h-80 overflow-y-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
                {formatJson(listOperation.data)}
              </pre>
            ) : (
              <p className="text-sm text-slate-500">As vendas serão carregadas automaticamente.</p>
            )}
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
