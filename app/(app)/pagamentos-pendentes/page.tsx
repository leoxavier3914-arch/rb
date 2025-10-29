import Link from 'next/link';
import type { SaleRow } from '@/lib/sales';
import { listPendingSales } from '@/lib/sales';
import { formatMoneyFromCentsWithCurrency, formatShortDate } from '@/lib/ui/format';
import { PendingStatusBadge } from '@/components/payments/PendingStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

interface PendingPaymentsPageProps {
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

function PendingPaymentsTable({ items }: { readonly items: readonly SaleRow[] }) {
  if (items.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={5} className="py-6 text-center text-slate-500">
          Nenhum pagamento pendente encontrado. As compras em aberto aparecerão aqui após a sincronização com a
          Kiwify.
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {items.map(item => (
        <TableRow key={item.id}>
          <TableCell className="font-mono text-xs text-slate-500">{item.id}</TableCell>
          <TableCell>
            <div className="flex flex-col">
              <span className="font-medium text-slate-900">{item.customer_name ?? 'Cliente'}</span>
              <span className="text-xs text-slate-500">{item.customer_email ?? '—'}</span>
            </div>
          </TableCell>
          <TableCell className="max-w-[220px] truncate text-slate-600">{item.product_title ?? 'Produto'}</TableCell>
          <TableCell>
            <div className="flex flex-col gap-1 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{formatShortDate(item.created_at ?? '') || '—'}</span>
              <PendingStatusBadge status={item.status} />
            </div>
          </TableCell>
          <TableCell className="text-right font-semibold text-slate-900">
            {formatMoneyFromCentsWithCurrency(item.total_amount_cents ?? item.net_amount_cents, item.currency ?? 'BRL')}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default async function PendingPaymentsPage({ searchParams }: PendingPaymentsPageProps) {
  const page = parsePage(searchParams?.page);
  const { items, total } = await listPendingSales(page, PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < pageCount ? page + 1 : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Pagamentos pendentes</h1>
        <p className="text-sm text-slate-500">
          Acompanhe as compras que ainda aguardam confirmação de pagamento. Cada página exibe 10 registros.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Fila de pendências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cliente / E-mail</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Criação &amp; status</TableHead>
                <TableHead className="text-right">Valor bruto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <PendingPaymentsTable items={items} />
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm text-slate-600">
            <span>
              Mostrando {from.toLocaleString('pt-BR')} - {to.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')} pendências
            </span>
            <div className="flex items-center gap-2">
              {prevPage ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/pagamentos-pendentes?page=${prevPage}`}>Página anterior</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Página anterior
                </Button>
              )}
              {nextPage ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/pagamentos-pendentes?page=${nextPage}`}>Próxima página</Link>
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
