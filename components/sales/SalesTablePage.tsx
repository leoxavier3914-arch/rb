import Link from 'next/link';
import { listSales } from '@/lib/sales';
import { formatMoneyFromCentsWithCurrency, formatShortDate } from '@/lib/ui/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface SalesTablePageProps {
  readonly page: number;
  readonly pageSize: number;
  readonly statusFilter?: string | readonly string[];
  readonly title: string;
  readonly description: string;
  readonly tableTitle: string;
  readonly emptyMessage: string;
  readonly summaryLabel: string;
  readonly basePath: string;
}

export async function SalesTablePage({
  page,
  pageSize,
  statusFilter,
  title,
  description,
  tableTitle,
  emptyMessage,
  summaryLabel,
  basePath
}: SalesTablePageProps) {
  const { items, total } = await listSales(page, pageSize, statusFilter);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = total === 0 ? 0 : Math.min(page * pageSize, total);

  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < pageCount ? page + 1 : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{description}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{tableTitle}</CardTitle>
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
                    {emptyMessage}
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
              Mostrando {from.toLocaleString('pt-BR')} - {to.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}{' '}
              {summaryLabel}
            </span>
            <div className="flex items-center gap-2">
              {prevPage ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`${basePath}?page=${prevPage}`}>Página anterior</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Página anterior
                </Button>
              )}
              {nextPage ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`${basePath}?page=${nextPage}`}>Próxima página</Link>
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
