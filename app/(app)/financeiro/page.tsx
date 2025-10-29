import { createKiwifyClient } from '@/lib/kiwify/client';
import { getBalance, listPayouts } from '@/lib/finance';
import { formatDateTime, formatMoneyFromCents } from '@/lib/ui/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreatePayoutForm } from './CreatePayoutForm';

export const dynamic = 'force-dynamic';

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

export default async function FinanceiroPage() {
  const client = await createKiwifyClient();
  const [balance, payouts] = await Promise.all([getBalance(client), listPayouts(client)]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Financeiro</h1>
        <p className="text-sm text-slate-500">
          Consulte o saldo disponível/pendente e acompanhe seus pedidos de saque diretamente da API oficial da Kiwify.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Saldo disponível</CardDescription>
            <CardTitle className="text-3xl text-slate-900">{formatMoneyFromCents(balance.availableCents)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Valor liberado para realizar novos saques imediatamente.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Saldo pendente</CardDescription>
            <CardTitle className="text-3xl text-slate-900">{formatMoneyFromCents(balance.pendingCents)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Montante aguardando liberação conforme o cronograma da Kiwify.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Entidade cadastrada</CardDescription>
            <CardTitle className="text-lg text-slate-900">
              {balance.legalEntityId ? balance.legalEntityId : 'Não informado'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Identificador da conta usado para as operações financeiras.
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="order-2 lg:order-1">
          <CardHeader>
            <CardTitle className="text-xl">Histórico de saques</CardTitle>
            <CardDescription>Últimas solicitações realizadas via API da Kiwify.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Criação</TableHead>
                  <TableHead>Atualização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-slate-500">
                      Nenhum saque encontrado para esta conta ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  payouts.items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs text-slate-500">{item.id}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium uppercase text-slate-600">
                          {formatStatus(item.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        {formatMoneyFromCents(item.amountCents)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {item.createdAt ? formatDateTime(item.createdAt) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {item.updatedAt ? formatDateTime(item.updatedAt) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="order-1 lg:order-2">
          <CardHeader>
            <CardTitle className="text-xl">Solicitar saque</CardTitle>
            <CardDescription>
              Informe o valor em reais para gerar uma nova solicitação de saque imediatamente com a Kiwify.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreatePayoutForm availableCents={balance.availableCents} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
