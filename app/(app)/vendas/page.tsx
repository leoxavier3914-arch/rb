import Link from 'next/link';
import { listDailySales, listSales } from '@/lib/sales';
import { formatMoneyFromCentsWithCurrency, formatShortDate } from '@/lib/ui/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SalesPerDayChart from '@/components/charts/SalesPerDayChart';

export const dynamic = 'force-dynamic';

interface SalesPageProps {
  readonly searchParams?: Record<string, string | string[]>;
}

const PAGE_SIZE = 10;

function parsePage(value: string | string[] | undefined): number {
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 1;
}

function parseSearch(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return undefined;
}

export default async function VendasPage({ searchParams }: SalesPageProps) {
  const page = parsePage(searchParams?.page);
  const query = parseSearch(searchParams?.q);
  const [salesPage, dailySales] = await Promise.all([
    listSales(page, PAGE_SIZE, undefined, query),
    listDailySales()
  ]);
  const { items, total } = salesPage;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < pageCount ? page + 1 : null;
  const hasFiltersApplied = typeof query === 'string' && query.length > 0;
  const pageQuerySuffix = hasFiltersApplied ? `&q=${encodeURIComponent(query ?? '')}` : '';

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Vendas</h1>
        <p className="text-sm text-slate-500">
          Lista completa das vendas armazenadas no Supabase a partir das sincronizações realizadas. Cada página exibe 10
          registros.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Vendas por dia</CardTitle>
        </CardHeader>
        <CardContent className="h-80 px-6 pb-6 pt-0">
          <SalesPerDayChart data={dailySales} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-xl">Registros de vendas</CardTitle>
          <form method="get" className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <div className="flex w-full flex-1 items-center gap-2 md:w-80">
              <input
                type="search"
                name="q"
                placeholder="Buscar por ID, cliente ou e-mail"
                defaultValue={query ?? ''}
                className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <div className="flex items-center gap-2 md:justify-end">
              <Button type="submit" variant="outline">
                Buscar
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/vendas">Limpar</Link>
              </Button>
            </div>
          </form>
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor líquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-slate-500">
                    {hasFiltersApplied ? (
                      <>
                        Nenhuma venda encontrada para o filtro informado.
                        <br />
                        Ajuste a busca ou limpe os filtros para tentar novamente.
                      </>
                    ) : (
                      <>Nenhum dado sincronizado ainda. Acesse Configs e clique em &quot;Sincronizar&quot;.</>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs text-slate-500">{item.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">{item.customer_name ?? 'Cliente'}</span>
                        <span className="text-xs text-slate-500">{item.customer_email ?? '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-slate-600">
                      {item.product_title ?? 'Produto'}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium uppercase text-slate-600">
                        {item.status ?? 'desconhecido'}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">{formatShortDate(item.created_at ?? '')}</span>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-slate-900">
                      {formatMoneyFromCentsWithCurrency(
                        item.net_amount_cents ?? item.total_amount_cents,
                        item.currency ?? 'BRL'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm text-slate-600">
            <span>
              Mostrando {from.toLocaleString('pt-BR')} - {to.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')} vendas
            </span>
            <div className="flex items-center gap-2">
              {prevPage ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/vendas?page=${prevPage}${pageQuerySuffix}`}>
                    Página anterior
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Página anterior
                </Button>
              )}
              {nextPage ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/vendas?page=${nextPage}${pageQuerySuffix}`}>
                    Próxima página
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Próxima página
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
