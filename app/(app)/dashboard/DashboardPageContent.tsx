'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import SalesVolumePanel, { type RangeSummaryChangeEvent } from '@/components/charts/SalesVolumePanel';
import { CreatePayoutForm } from '@/app/(app)/financeiro/CreatePayoutForm';
import type { BalanceInfo } from '@/lib/finance';
import type { DailySalesRow, SalesPage, SalesSummary } from '@/lib/sales';
import { formatDateTime, formatMoneyFromCents, formatMoneyFromCentsWithCurrency, formatShortDate } from '@/lib/ui/format';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, PiggyBank, RefreshCcw, ShoppingCart, Ticket, Trophy, Wallet2 } from 'lucide-react';

interface DashboardPageContentProps {
  readonly summary: SalesSummary;
  readonly recent: SalesPage;
  readonly balance: BalanceInfo;
  readonly dailySales: readonly DailySalesRow[];
}

interface FilteredTotals {
  readonly totalSales: number;
  readonly grossAmountCents: number;
  readonly netAmountCents: number;
  readonly feeAmountCents: number;
  readonly isFiltered: boolean;
}

function toFilteredTotals(summary: SalesSummary, isFiltered: boolean): FilteredTotals {
  return {
    totalSales: summary.totalSales,
    grossAmountCents: summary.grossAmountCents,
    netAmountCents: summary.netAmountCents,
    feeAmountCents: summary.feeAmountCents,
    isFiltered
  };
}

export function DashboardPageContent({ summary, recent, balance, dailySales }: DashboardPageContentProps) {
  const baseTotals = useMemo(() => toFilteredTotals(summary, false), [summary]);
  const [filteredTotals, setFilteredTotals] = useState<FilteredTotals>(() => baseTotals);

  const effectiveTotals = filteredTotals.isFiltered ? filteredTotals : baseTotals;

  useEffect(() => {
    if (!filteredTotals.isFiltered) {
      setFilteredTotals(baseTotals);
    }
  }, [baseTotals, filteredTotals.isFiltered]);

  const averageNetCents = useMemo(
    () => (effectiveTotals.totalSales > 0 ? Math.round(effectiveTotals.netAmountCents / effectiveTotals.totalSales) : 0),
    [effectiveTotals.netAmountCents, effectiveTotals.totalSales]
  );

  const goalAmountCents = 10_000_00;
  const goalProgress = useMemo(
    () => Math.min(100, Math.round((effectiveTotals.netAmountCents / goalAmountCents) * 100)),
    [effectiveTotals.netAmountCents]
  );

  const handleRangeSummaryChange = useCallback(
    (event: RangeSummaryChangeEvent) => {
      if (!event) {
        return;
      }

      if (!event.hasActiveFilter) {
        setFilteredTotals(baseTotals);
        return;
      }

      setFilteredTotals({
        totalSales: event.totals.totalSales,
        grossAmountCents: event.totals.grossAmountCents,
        netAmountCents: event.totals.netAmountCents,
        feeAmountCents: event.totals.feeAmountCents,
        isFiltered: true
      });
    },
    [baseTotals]
  );

  const insightCards = useMemo(
    () => [
      {
        label: 'Total em vendas',
        value: formatMoneyFromCentsWithCurrency(effectiveTotals.grossAmountCents, 'BRL'),
        helper: 'Valor bruto acumulado',
        icon: PiggyBank
      },
      {
        label: 'Receita líquida',
        value: formatMoneyFromCentsWithCurrency(effectiveTotals.netAmountCents, 'BRL'),
        helper: 'Saldo após taxas',
        icon: Wallet2
      },
      {
        label: 'Taxas Kiwify',
        value: formatMoneyFromCentsWithCurrency(effectiveTotals.feeAmountCents, 'BRL'),
        helper: 'Somatório de taxas retidas',
        icon: CreditCard
      },
      {
        label: 'Ticket médio líquido',
        value: effectiveTotals.totalSales > 0 ? formatMoneyFromCentsWithCurrency(averageNetCents, 'BRL') : '—',
        helper: 'Média por venda concluída',
        icon: Ticket
      },
      {
        label: 'Última venda',
        value: summary.lastSaleAt ? formatDateTime(summary.lastSaleAt) : 'Sem vendas registradas',
        helper: 'Atualizado automaticamente',
        icon: ShoppingCart
      },
      {
        label: 'Última sincronização',
        value: summary.lastSyncedAt ? formatDateTime(summary.lastSyncedAt) : 'Nenhuma sincronização registrada',
        helper: 'Via botão "Sincronizar"',
        icon: RefreshCcw
      }
    ],
    [averageNetCents, effectiveTotals, summary.lastSaleAt, summary.lastSyncedAt]
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Visão geral das vendas sincronizadas com a API oficial da Kiwify e armazenadas no Supabase, com um layout inspirado no
          painel Kiwify.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
            <SalesVolumePanel dailySales={dailySales} currency="BRL" onRangeSummaryChange={handleRangeSummaryChange} />

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {insightCards.map(card => {
                const Icon = card.icon;
                return (
                  <Card
                    key={card.label}
                    className="rounded-3xl border-none bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5"
                  >
                    <CardHeader className="border-b-0 p-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardDescription className="text-xs uppercase tracking-wide text-slate-400">{card.label}</CardDescription>
                          <CardTitle className="mt-2 text-2xl text-slate-900">{card.value}</CardTitle>
                        </div>
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                          <Icon className="h-6 w-6" />
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="px-0 pt-4 text-xs text-slate-500">{card.helper}</CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <Card className="rounded-3xl border-none bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">Meta de faturamento</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {formatMoneyFromCentsWithCurrency(effectiveTotals.netAmountCents, 'BRL')}
                </p>
                <p className="text-xs text-slate-400">de {formatMoneyFromCentsWithCurrency(goalAmountCents, 'BRL')} alcançados</p>
              </div>
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0231b1]/10 text-[#0231b1]">
                <Trophy className="h-8 w-8" />
              </span>
            </div>
            <div className="mt-6 h-2 rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0231b1] via-[#1767ff] to-[#3abff8]"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">Próxima premiação: placa exclusiva Kiwify Pearl.</p>
          </Card>

          <Card className="rounded-3xl border-none bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Financeiro</p>
                  <div className="space-y-1">
                    <p className="text-sm text-slate-500">Saldo disponível para saque</p>
                    <p className="text-3xl font-semibold text-slate-900">{formatMoneyFromCents(balance.availableCents)}</p>
                  </div>
                </div>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0231b1]/10 text-[#0231b1]">
                  <Wallet2 className="h-7 w-7" />
                </span>
              </div>
              <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Solicitar novo saque</p>
                  <p className="text-xs text-slate-500">Informe o valor desejado e envie a solicitação diretamente para a Kiwify.</p>
                </div>
                <CreatePayoutForm availableCents={balance.availableCents} variant="dashboard" />
                <p className="text-xs text-slate-500">Processaremos o pedido imediatamente de acordo com as regras vigentes da plataforma.</p>
              </div>
            </div>
          </Card>

          <Card className="rounded-3xl border-none bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">Sincronização</p>
                <p className="text-base font-semibold text-slate-900">Resumo das vendas</p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <RefreshCcw className="h-6 w-6" />
              </span>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span>Vendas sincronizadas</span>
                <span className="text-sm font-semibold text-slate-900">{effectiveTotals.totalSales.toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>Última venda</span>
                <span className="text-sm font-semibold text-slate-900">
                  {summary.lastSaleAt ? formatShortDate(summary.lastSaleAt) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>Última sincronização</span>
                <span className="text-right text-sm font-semibold text-slate-900">
                  {summary.lastSyncedAt ? formatDateTime(summary.lastSyncedAt) : 'Nenhuma sincronização registrada'}
                </span>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      <section>
        <Card className="rounded-3xl border-none bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <CardHeader className="border-b-0 p-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="text-2xl text-slate-900">Vendas recentes</CardTitle>
                <CardDescription className="text-sm text-slate-500">Últimas cinco vendas sincronizadas com a plataforma.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pt-6">
            <Table className="text-sm">
              <TableHeader className="bg-white text-xs text-slate-400">
                <TableRow className="border-b border-slate-100">
                  <TableHead className="text-slate-400">Cliente</TableHead>
                  <TableHead className="text-slate-400">Produto</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-right text-slate-400">Valor líquido</TableHead>
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
                    <TableRow key={item.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-900">{item.customer_name ?? 'Cliente'}</span>
                          <span className="text-xs text-slate-400">{formatShortDate(item.created_at ?? '')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-slate-500">{item.product_title ?? 'Produto'}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-[#0231b1]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#0231b1]">
                          {item.status ?? 'desconhecido'}
                        </span>
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
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default DashboardPageContent;
