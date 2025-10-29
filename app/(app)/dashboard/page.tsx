import { listSales, getSalesSummary } from '@/lib/sales';
import { formatDateTime, formatMoneyFromCentsWithCurrency, formatShortDate } from '@/lib/ui/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [summary, recent] = await Promise.all([getSalesSummary(), listSales(1, 5)]);

  const stats = [
    {
      label: 'Total de vendas',
      value: summary.totalSales.toLocaleString('pt-BR'),
      helper: summary.lastSaleAt ? `Última venda em ${formatDateTime(summary.lastSaleAt)}` : 'Sem vendas ainda'
    },
    {
      label: 'Receita bruta',
      value: formatMoneyFromCentsWithCurrency(summary.grossAmountCents, 'BRL'),
      helper: 'Valor acumulado das vendas'
    },
    {
      label: 'Receita líquida',
      value: formatMoneyFromCentsWithCurrency(summary.netAmountCents, 'BRL'),
      helper: 'Total após taxas'
    },
    {
      label: 'Taxas Kiwify',
      value: formatMoneyFromCentsWithCurrency(summary.feeAmountCents, 'BRL'),
      helper: 'Soma das taxas retidas'
    }
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Visão geral das vendas sincronizadas com a API oficial da Kiwify e armazenadas no Supabase.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(stat => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-500">{stat.helper}</CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sincronização</CardTitle>
            <CardDescription>Histórico resumido da importação via botão &quot;Sincronizar&quot;.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-600">Vendas sincronizadas</span>
              <span className="text-slate-900">{summary.totalSales.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-600">Última sincronização</span>
              <span className="text-slate-900">
                {summary.lastSyncedAt ? formatDateTime(summary.lastSyncedAt) : 'Nenhuma sincronização registrada'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Vendas recentes</CardTitle>
            <CardDescription>Últimas cinco vendas disponíveis no Supabase.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-slate-500">
                      Nenhuma venda sincronizada ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  recent.items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{item.customer_name ?? 'Cliente'}</span>
                          <span className="text-xs text-slate-500">{formatShortDate(item.created_at ?? '')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-slate-600">
                        {item.product_title ?? 'Produto'}
                      </TableCell>
                      <TableCell>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium uppercase text-slate-600">
                          {item.status ?? 'desconhecido'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-900">
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
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
