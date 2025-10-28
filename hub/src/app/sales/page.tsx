import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { listSales } from "@/lib/sales";
import { formatCurrencyFromCents, formatDateTime } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

interface SalesPageProps {
  readonly searchParams?: Record<string, string | string[] | undefined>;
}

function parsePage(searchParams?: Record<string, string | string[] | undefined>): number {
  const raw = searchParams?.page;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const page = parsePage(searchParams);
  const sales = await listSales(page, 10);

  const hasPrevious = sales.page > 1;
  const hasNext = sales.page < sales.totalPages;

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader
          title="Vendas"
          subtitle="Lista oficial sincronizada diretamente do Supabase"
          action={<span className="text-xs font-medium uppercase tracking-wide text-slate-500">{sales.totalItems} registros</span>}
        />
        <CardContent className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <Table>
              <THead>
                <TR>
                  <TH>ID</TH>
                  <TH>Cliente</TH>
                  <TH>Produto</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Pago em</TH>
                </TR>
              </THead>
              <TBody>
                {sales.items.length === 0 ? (
                  <TR>
                    <TD className="py-6 text-center text-slate-500" colSpan={6}>
                      Nenhuma venda sincronizada. Utilize o botão de sincronização nas configurações.
                    </TD>
                  </TR>
                ) : (
                  sales.items.map(sale => (
                    <TR key={sale.id}>
                      <TD className="font-mono text-xs text-slate-500">{sale.id}</TD>
                      <TD>{sale.customer_name ?? sale.customer_email ?? "Cliente"}</TD>
                      <TD>{sale.product_name ?? "Produto"}</TD>
                      <TD>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium capitalize text-slate-600">
                          {sale.status ?? "desconhecido"}
                        </span>
                      </TD>
                      <TD className="text-right font-medium text-slate-900">
                        {formatCurrencyFromCents(sale.total_amount_cents, sale.currency ?? undefined)}
                      </TD>
                      <TD>{formatDateTime(sale.paid_at ?? sale.created_at)}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Página {sales.page} de {sales.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <PaginationButton disabled={!hasPrevious} href={`/sales?page=${sales.page - 1}`} icon={<ChevronLeft className="h-4 w-4" />}>
                Anterior
              </PaginationButton>
              <PaginationButton disabled={!hasNext} href={`/sales?page=${sales.page + 1}`} icon={<ChevronRight className="h-4 w-4" />}>
                Próxima
              </PaginationButton>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PaginationButton({
  disabled,
  href,
  children,
  icon
}: {
  readonly disabled: boolean;
  readonly href: string;
  readonly children: React.ReactNode;
  readonly icon: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400">
        {icon}
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
    >
      {icon}
      {children}
    </Link>
  );
}
