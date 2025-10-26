'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Heart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePeriod } from '@/components/providers/PeriodProvider';
import { useLocalStorage } from '@/lib/ui/useLocalStorage';
import { createPeriodSearchParams } from '@/lib/ui/date';
import { formatMoneyFromCents, formatShortDate } from '@/lib/ui/format';
import { TableSkeleton } from '@/components/ui/Skeletons';

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
}

const DEFAULT_COLUMNS = ['id', 'customer', 'status', 'total_cents', 'created_at'] as const;
const COLUMN_LABELS: Record<(typeof DEFAULT_COLUMNS)[number], string> = {
  id: 'ID',
  customer: 'Cliente',
  status: 'Status',
  total_cents: 'Valor',
  created_at: 'Data'
};

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export default function SalesPage(): JSX.Element {
  const { range, preset, isPreset } = usePeriod();
  const params = useMemo(
    () => createPeriodSearchParams(range, isPreset ? preset : null),
    [isPreset, preset, range]
  );
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

  const salesQuery = useQuery<SalesResponse, Error>({
    queryKey: ['hub-sales', params.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/hub/sales?${params.toString()}`, {
        headers: { 'x-admin-role': 'true' }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        const message = payload?.error ?? 'Erro ao carregar vendas.';
        throw new Error(message);
      }
      return payload as SalesResponse;
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
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        const message = payload?.error ?? 'Não foi possível salvar o favorito.';
        throw new Error(message);
      }
      setFavoriteStatus('success');
    } catch (error) {
      setFavoriteStatus('error');
      setFavoriteError(error instanceof Error ? error.message : 'Erro ao salvar favorito.');
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

  const rows = salesQuery.data?.items ?? [];

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
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {salesQuery.error.message}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-600">
              Nenhuma venda sincronizada para este intervalo. Inicie uma sincronização para visualizar novos resultados.
            </div>
          ) : (
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
                  <TableRow key={row.id}>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
