'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Heart, Loader2, Trash } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePeriod } from '@/components/providers/PeriodProvider';
import { useLocalStorage } from '@/lib/ui/useLocalStorage';
import { createPeriodSearchParams } from '@/lib/ui/date';
import { formatMoneyFromCents, formatShortDate } from '@/lib/ui/format';
import { TableSkeleton } from '@/components/ui/Skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import { ApiError, buildApiError } from '@/lib/ui/apiError';

interface Sale {
  readonly id: string;
  readonly customer: string;
  readonly status: string;
  readonly total_cents: number;
  readonly created_at: string;
}

interface SalesResponse {
  readonly ok: true;
  readonly items: readonly Sale[];
  readonly page: number;
  readonly page_size: number;
  readonly total: number;
}

interface SaleDetailResponse {
  readonly ok: true;
  readonly sale: SaleDetail;
  readonly events: readonly SaleEvent[];
  readonly notes: readonly SaleNote[];
  readonly versions: readonly SaleVersion[];
}

interface SaleDetail {
  readonly id: string;
  readonly status: string | null;
  readonly total_amount_cents: number | null;
  readonly net_amount_cents: number | null;
  readonly fee_amount_cents: number | null;
  readonly created_at: string | null;
  readonly paid_at: string | null;
  readonly updated_at: string | null;
  readonly customer_id: string | null;
  readonly product_id: string | null;
}

interface SaleEvent {
  readonly id: string;
  readonly type: string;
  readonly at: string;
  readonly meta: unknown;
}

interface SaleNote {
  readonly id: string;
  readonly body: string;
  readonly author: string | null;
  readonly created_at: string;
}

interface SaleVersion {
  readonly id: string;
  readonly version: number;
  readonly data: unknown;
  readonly changed_at: string;
}

const DEFAULT_COLUMNS = ['id', 'customer', 'status', 'total_cents', 'created_at'] as const;
const COLUMN_LABELS: Record<(typeof DEFAULT_COLUMNS)[number], string> = {
  id: 'ID',
  customer: 'Cliente',
  status: 'Status',
  total_cents: 'Valor',
  created_at: 'Data'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSale(value: unknown): value is Sale {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.customer === 'string' &&
    typeof value.status === 'string' &&
    typeof value.total_cents === 'number' &&
    typeof value.created_at === 'string'
  );
}

function isSalesResponse(value: unknown): value is SalesResponse {
  return (
    isRecord(value) &&
    value.ok === true &&
    Array.isArray(value.items) &&
    value.items.every(isSale) &&
    typeof value.page === 'number' &&
    Number.isFinite(value.page) &&
    typeof value.page_size === 'number' &&
    Number.isFinite(value.page_size) &&
    typeof value.total === 'number' &&
    Number.isFinite(value.total)
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isSaleDetail(value: unknown): value is SaleDetail {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    isNullableString(value.status) &&
    isNullableNumber(value.total_amount_cents) &&
    isNullableNumber(value.net_amount_cents) &&
    isNullableNumber(value.fee_amount_cents) &&
    isNullableString(value.created_at) &&
    isNullableString(value.paid_at) &&
    isNullableString(value.updated_at) &&
    isNullableString(value.customer_id) &&
    isNullableString(value.product_id)
  );
}

function isSaleEvent(value: unknown): value is SaleEvent {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.at === 'string'
  );
}

function isSaleNote(value: unknown): value is SaleNote {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.body === 'string' &&
    isNullableString(value.author) &&
    typeof value.created_at === 'string'
  );
}

function isSaleVersion(value: unknown): value is SaleVersion {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.version === 'number' &&
    typeof value.changed_at === 'string'
  );
}

function isSaleDetailResponse(value: unknown): value is SaleDetailResponse {
  return (
    isRecord(value) &&
    value.ok === true &&
    isSaleDetail(value.sale) &&
    Array.isArray(value.events) &&
    value.events.every(isSaleEvent) &&
    Array.isArray(value.notes) &&
    value.notes.every(isSaleNote) &&
    Array.isArray(value.versions) &&
    value.versions.every(isSaleVersion)
  );
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return value;
  }
}

export default function SalesPage() {
  const { range, preset, isPreset } = usePeriod();
  const periodParams = useMemo(
    () => createPeriodSearchParams(range, isPreset ? preset : null),
    [isPreset, preset, range]
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => {
    setPage(1);
  }, [periodParams]);
  const params = useMemo(() => {
    const searchParams = new URLSearchParams(periodParams);
    searchParams.set('page', String(page));
    searchParams.set('page_size', String(pageSize));
    return searchParams;
  }, [periodParams, page, pageSize]);
  const [columnsState, setColumnsState] = useLocalStorage<string[]>('rb.tableCols.sales', [...DEFAULT_COLUMNS]);
  const sanitizeColumns = useCallback((input: readonly string[]) => {
    const filtered = input.filter((column, index) => DEFAULT_COLUMNS.includes(column as any) && input.indexOf(column) === index);
    const missing = DEFAULT_COLUMNS.filter(column => !filtered.includes(column));
    return [...filtered, ...missing];
  }, []);

  useEffect(() => {
    const sanitized = sanitizeColumns(columnsState);
    if (!arraysEqual(sanitized, columnsState)) {
      setColumnsState(sanitized);
    }
  }, [columnsState, sanitizeColumns, setColumnsState]);

  const columns = useMemo(() => sanitizeColumns(columnsState), [columnsState, sanitizeColumns]);

  const [favoriteStatus, setFavoriteStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<{
    status: 'idle' | 'loading' | 'error';
    error: string | null;
    data: SaleDetailResponse | null;
  }>({ status: 'idle', error: null, data: null });
  const [noteBody, setNoteBody] = useState('');
  const [noteStatus, setNoteStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [noteError, setNoteError] = useState<string | null>(null);

  const salesQuery = useQuery<SalesResponse, Error>({
    queryKey: ['hub-sales', params.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/hub/sales?${params.toString()}`, {
        headers: { 'x-admin-role': 'true' }
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      const errorPayload = isRecord(payload) ? payload : null;
      if (!response.ok || errorPayload?.ok === false) {
        throw buildApiError(errorPayload, 'Erro ao carregar vendas.');
      }
      if (!isSalesResponse(payload)) {
        throw buildApiError(null, 'Erro ao carregar vendas.');
      }
      return payload;
    },
    staleTime: 60_000,
    retry: false
  });

  const saveFavorite = async (): Promise<void> => {
    setFavoriteStatus('saving');
    setFavoriteError(null);
    try {
      const response = await fetch('/api/hub/views', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-role': 'true'
        },
        body: JSON.stringify({
          resource: 'sales',
          filters: Object.fromEntries(params.entries()),
          columns
        })
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok || (payload as { ok?: boolean }).ok === false) {
        throw buildApiError(payload, 'Não foi possível salvar o favorito.');
      }
      setFavoriteStatus('success');
    } catch (error) {
      setFavoriteStatus('error');
      setFavoriteError(
        error instanceof ApiError
          ? `${error.message} (código: ${error.code})`
          : error instanceof Error
            ? error.message
            : 'Erro ao salvar favorito.'
      );
    }
  };

  const moveColumn = (column: string, direction: 'up' | 'down'): void => {
    setColumnsState(current => {
      const sanitized = sanitizeColumns(current);
      const index = sanitized.indexOf(column);
      if (index === -1) {
        return sanitized;
      }
      const nextIndex = direction === 'up' ? Math.max(0, index - 1) : Math.min(sanitized.length - 1, index + 1);
      if (index === nextIndex) {
        return sanitized;
      }
      const updated = [...sanitized];
      const [removed] = updated.splice(index, 1);
      updated.splice(nextIndex, 0, removed);
      return updated;
    });
  };

  const responsePage = salesQuery.data?.page;
  const responsePageSize = salesQuery.data?.page_size;

  useEffect(() => {
    if (responsePage !== undefined && responsePage !== page) {
      setPage(responsePage);
    }
    if (responsePageSize !== undefined && responsePageSize !== pageSize) {
      setPageSize(responsePageSize);
    }
  }, [page, pageSize, responsePage, responsePageSize]);

  const rows = salesQuery.data?.items ?? [];
  const totalItems = salesQuery.data?.total ?? rows.length;
  const currentPageSize = salesQuery.data?.page_size ?? pageSize;
  const totalPages = totalItems > 0 ? Math.max(1, Math.ceil(totalItems / currentPageSize)) : 1;
  const displayedPage = responsePage ?? page;
  const hasPreviousPage = page > 1;
  const hasNextPage = page < totalPages;

  const goToPreviousPage = () => {
    setPage(current => Math.max(1, current - 1));
  };

  const goToNextPage = () => {
    setPage(current => Math.min(totalPages, current + 1));
  };

  const changePageSize = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  const resolveErrorCode = (error: Error): string => (error instanceof ApiError ? error.code : 'unknown_error');
  const renderErrorNotice = (title: string, error: Error) => (
    <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      <p className="font-semibold text-rose-700">{title}</p>
      <p className="mt-1 text-xs text-rose-600">Código: {resolveErrorCode(error)}</p>
      <p className="mt-1">{error.message}</p>
    </div>
  );

  const openDrawerForSale = async (saleId: string): Promise<void> => {
    setSelectedSaleId(saleId);
    setDrawerOpen(true);
    setDetailState({ status: 'loading', error: null, data: null });
    try {
      const response = await fetch(`/api/hub/sales/${saleId}`, {
        headers: { 'x-admin-role': 'true' }
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      const errorPayload = isRecord(payload) ? payload : null;
      if (!response.ok || errorPayload?.ok === false) {
        throw buildApiError(errorPayload, 'Não foi possível carregar os detalhes da venda.');
      }
      if (!isSaleDetailResponse(payload)) {
        throw buildApiError(null, 'Não foi possível carregar os detalhes da venda.');
      }
      setDetailState({ status: 'idle', error: null, data: payload });
    } catch (error) {
      setDetailState({
        status: 'error',
        error:
          error instanceof ApiError
            ? `${error.message} (código: ${error.code})`
            : error instanceof Error
              ? error.message
              : 'Erro ao carregar detalhes.',
        data: null
      });
    }
  };

  const closeDrawer = (): void => {
    setDrawerOpen(false);
    setSelectedSaleId(null);
    setDetailState({ status: 'idle', error: null, data: null });
    setNoteBody('');
    setNoteStatus('idle');
    setNoteError(null);
  };

  const submitNote = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedSaleId || noteBody.trim().length === 0) {
      return;
    }
    setNoteStatus('saving');
    setNoteError(null);
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-role': 'true'
        },
        body: JSON.stringify({
          entity_type: 'sale',
          entity_id: selectedSaleId,
          body: noteBody.trim()
        })
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok || (payload as { ok?: boolean }).ok === false) {
        throw buildApiError(payload, 'Não foi possível adicionar a nota.');
      }
      setDetailState(current =>
        current.data
          ? {
              status: 'idle',
              error: null,
              data: {
                ...current.data,
                notes: [payload.note as SaleNote, ...current.data.notes]
              }
            }
          : current
      );
      setNoteBody('');
      setNoteStatus('idle');
    } catch (error) {
      setNoteStatus('error');
      setNoteError(
        error instanceof ApiError
          ? `${error.message} (código: ${error.code})`
          : error instanceof Error
            ? error.message
            : 'Erro ao criar nota.'
      );
    }
  };

  const removeNote = async (noteId: string): Promise<void> => {
    setNoteError(null);
    try {
      const response = await fetch(`/api/notes?id=${noteId}`, {
        method: 'DELETE',
        headers: { 'x-admin-role': 'true' }
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok || (payload as { ok?: boolean }).ok === false) {
        throw buildApiError(payload, 'Não foi possível remover a nota.');
      }
      setDetailState(current =>
        current.data
          ? {
              status: 'idle',
              error: null,
              data: {
                ...current.data,
                notes: current.data.notes.filter(note => note.id !== noteId)
              }
            }
          : current
      );
    } catch (error) {
      setNoteError(
        error instanceof ApiError
          ? `${error.message} (código: ${error.code})`
          : error instanceof Error
            ? error.message
            : 'Erro ao remover nota.'
      );
    }
  };

  const renderDrawerContent = () => {
    if (detailState.status === 'loading') {
      return (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando detalhes...
        </div>
      );
    }

    if (detailState.status === 'error') {
      return <div className="text-sm text-rose-600">{detailState.error}</div>;
    }

    if (!detailState.data) {
      return <div className="text-sm text-slate-600">Selecione uma venda para visualizar os detalhes.</div>;
    }

    const { sale, events, notes, versions } = detailState.data;
    return (
      <div className="flex flex-col gap-6">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Informações gerais</h3>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>
              <span className="font-medium text-slate-900">Status:</span> {sale.status ?? 'não informado'}
            </li>
            <li>
              <span className="font-medium text-slate-900">Valor total:</span>{' '}
              {formatMoneyFromCents(sale.total_amount_cents ?? 0)}
            </li>
            <li>
              <span className="font-medium text-slate-900">Valor líquido:</span>{' '}
              {formatMoneyFromCents(sale.net_amount_cents ?? 0)}
            </li>
            <li>
              <span className="font-medium text-slate-900">Taxas:</span>{' '}
              {formatMoneyFromCents(sale.fee_amount_cents ?? 0)}
            </li>
            <li>
              <span className="font-medium text-slate-900">Criada em:</span> {formatDateTime(sale.created_at)}
            </li>
            <li>
              <span className="font-medium text-slate-900">Pagamento:</span> {formatDateTime(sale.paid_at)}
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Linha do tempo</h3>
          {events.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum evento registrado.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-600">
              {events.map(event => (
                <li key={event.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{event.type}</span>
                    <span>{formatDateTime(event.at)}</span>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-500">
                    {JSON.stringify(event.meta, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Notas</h3>
            {noteError && <span className="text-xs text-rose-600">{noteError}</span>}
          </div>
          <form className="space-y-2" onSubmit={submitNote}>
            <textarea
              className="h-24 w-full resize-none rounded-md border border-slate-300 p-2 text-sm text-slate-900"
              value={noteBody}
              onChange={event => setNoteBody(event.target.value)}
              placeholder="Adicionar nova nota"
            />
            <Button type="submit" disabled={noteStatus === 'saving' || noteBody.trim().length === 0}>
              {noteStatus === 'saving' ? 'Salvando...' : 'Registrar nota'}
            </Button>
          </form>
          {notes.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma nota registrada ainda.</p>
          ) : (
            <ul className="space-y-2">
              {notes.map(note => (
                <li key={note.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{note.author ?? 'Sem autor'}</span>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-rose-600 transition hover:text-rose-700"
                      onClick={() => removeNote(note.id)}
                    >
                      <Trash className="h-3 w-3" aria-hidden /> Remover
                    </button>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap">{note.body}</p>
                  <span className="mt-2 block text-xs text-slate-400">{formatDateTime(note.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Histórico de versões</h3>
          {versions.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma alteração registrada.</p>
          ) : (
            <ul className="space-y-2 text-xs text-slate-600">
              {versions.map(version => (
                <li key={version.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Versão {version.version}</span>
                    <span>{formatDateTime(version.changed_at)}</span>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-500">
                    {JSON.stringify(version.data, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900">Vendas</h1>
        <p className="text-sm text-slate-600">
          Visualize as vendas sincronizadas para o período selecionado, personalize as colunas e salve a visão favorita.
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          Intervalo ativo:&nbsp;
          <span className="font-medium text-slate-900">
            {isPreset && preset ? `${preset} dias` : `${formatShortDate(range.from)} → ${formatShortDate(range.to)}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={saveFavorite} disabled={favoriteStatus === 'saving'} className="gap-2">
            <Heart className="h-4 w-4" aria-hidden /> Salvar como favorito
          </Button>
          <Button asChild variant="secondary">
            <Link href="/config-sync">Sincronizar agora</Link>
          </Button>
        </div>
      </div>
      {favoriteStatus === 'success' && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Visão salva com sucesso.
        </div>
      )}
      {favoriteStatus === 'error' && favoriteError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{favoriteError}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Colunas da tabela</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-slate-600">
          {columns.map((column, index) => (
            <div key={column} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
              <span>{COLUMN_LABELS[column as keyof typeof COLUMN_LABELS]}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveColumn(column, 'up')}
                  disabled={index === 0}
                  className="rounded-md border border-slate-200 p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Mover ${COLUMN_LABELS[column as keyof typeof COLUMN_LABELS]} para cima`}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => moveColumn(column, 'down')}
                  disabled={index === columns.length - 1}
                  className="rounded-md border border-slate-200 p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Mover ${COLUMN_LABELS[column as keyof typeof COLUMN_LABELS]} para baixo`}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabela de vendas</CardTitle>
        </CardHeader>
        <CardContent>
          {salesQuery.isLoading ? (
            <TableSkeleton rows={6} />
          ) : salesQuery.isError ? (
            renderErrorNotice('Não foi possível carregar as vendas.', salesQuery.error)
          ) : rows.length === 0 ? (
            <EmptyState
              title="Nenhuma venda sincronizada"
              description="Nenhuma venda sincronizada para este intervalo. Inicie uma sincronização para visualizar novos resultados."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map(column => (
                      <TableHead key={column}>{COLUMN_LABELS[column as keyof typeof COLUMN_LABELS]}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => openDrawerForSale(row.id)}
                    >
                      {columns.map(column => (
                        <TableCell key={`${row.id}-${column}`}>
                          {column === 'id'
                            ? row.id
                            : column === 'customer'
                            ? row.customer
                            : column === 'status'
                            ? row.status
                            : column === 'total_cents'
                            ? formatMoneyFromCents(row.total_cents)
                            : formatShortDate(row.created_at)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span>
                    Página {displayedPage} de {totalPages}
                  </span>
                  <span className="hidden sm:inline" aria-hidden>
                    •
                  </span>
                  <span>Total de {totalItems} resultados</span>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <label className="flex items-center gap-2">
                    <span>Itens por página</span>
                    <select
                      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                      value={pageSize}
                      onChange={event => changePageSize(Number(event.target.value))}
                    >
                      {[10, 25, 50].map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousPage}
                      disabled={!hasPreviousPage || salesQuery.isFetching}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextPage}
                      disabled={!hasNextPage || salesQuery.isFetching}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Drawer
        title={selectedSaleId ? `Detalhes da venda ${selectedSaleId}` : 'Detalhes da venda'}
        open={drawerOpen}
        onOpenChange={open => {
          if (!open) {
            closeDrawer();
          } else {
            setDrawerOpen(true);
          }
        }}
      >
        {renderDrawerContent()}
      </Drawer>
    </div>
  );
}
