import { ArrowDownRight, ArrowUpRight, Clock3 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { fetchSalesStats, listSales } from "@/lib/sales";
import { formatCurrencyFromCents, formatDateTime, formatNumber } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, recentSales] = await Promise.all([fetchSalesStats(), listSales(1, 5)]);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-700 text-white">
          <CardHeader title="Total de vendas" subtitle="Vendas sincronizadas" />
          <CardContent className="space-y-6">
            <p className="text-4xl font-semibold">{formatNumber(stats.totalSales)}</p>
            <span className="flex items-center gap-2 text-sm text-slate-200">
              <ArrowUpRight className="h-4 w-4" /> Sincronizado com Supabase
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Receita bruta" subtitle="Somatório total" />
          <CardContent className="space-y-4">
            <p className="text-3xl font-semibold text-slate-900">
              {formatCurrencyFromCents(stats.grossAmountCents)}
            </p>
            <span className="flex items-center gap-2 text-sm text-slate-500">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" /> Crescimento saudável
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Receita líquida" subtitle="Após taxas" />
          <CardContent className="space-y-4">
            <p className="text-3xl font-semibold text-slate-900">
              {formatCurrencyFromCents(stats.netAmountCents)}
            </p>
            <span className="flex items-center gap-2 text-sm text-slate-500">
              <ArrowDownRight className="h-4 w-4 text-slate-400" /> Descontadas taxas e fees
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Última venda" subtitle="Momento de registro" />
          <CardContent className="space-y-4">
            <p className="text-xl font-semibold text-slate-900">{formatDateTime(stats.lastSaleAt)}</p>
            <span className="flex items-center gap-2 text-sm text-slate-500">
              <Clock3 className="h-4 w-4" /> Atualize sempre que necessário nas configs
            </span>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader title="Últimas vendas" subtitle="Resumo dos 5 registros mais recentes" />
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <Table>
                <THead>
                  <TR>
                    <TH>ID</TH>
                    <TH>Cliente</TH>
                    <TH>Produto</TH>
                    <TH className="text-right">Total</TH>
                    <TH>Data</TH>
                  </TR>
                </THead>
                <TBody>
                  {recentSales.items.length === 0 ? (
                    <TR>
                      <TD className="py-6 text-center text-slate-500" colSpan={5}>
                        Nenhuma venda sincronizada até o momento.
                      </TD>
                    </TR>
                  ) : (
                    recentSales.items.map(sale => (
                      <TR key={sale.id}>
                        <TD className="font-mono text-xs text-slate-500">{sale.id}</TD>
                        <TD>{sale.customer_name ?? "Cliente"}</TD>
                        <TD>{sale.product_name ?? "Produto"}</TD>
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
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
