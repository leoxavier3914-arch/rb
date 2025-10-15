'use client';

import { useMemo } from 'react';
import Badge from './Badge';
import Table from './Table';
import { formatSaoPaulo } from '../lib/dates';
import { getBadgeVariant, STATUS_LABEL } from '../lib/status';
import type { DashboardSale, DashboardSaleStatus } from '../lib/types';

const EMPTY_MESSAGE_BY_STATUS: Record<DashboardSaleStatus, string> = {
  approved: 'Nenhuma venda encontrada com status aprovado.',
  refunded: 'Nenhuma venda encontrada com status reembolsado.',
  abandoned: 'Nenhum registro encontrado com status abandonado.',
  refused: 'Nenhuma venda encontrada com status recusado.',
  new: 'Nenhum registro encontrado com status novo.',
};

type StatusSalesTableProps = {
  sales: DashboardSale[];
  status: DashboardSaleStatus;
  title: string;
  description: string;
};

export default function StatusSalesTable({ sales, status, title, description }: StatusSalesTableProps) {
  const filteredSales = useMemo(
    () => sales.filter((sale) => sale.status === status),
    [sales, status],
  );

  const columns = useMemo(
    () => [
      {
        key: 'customer' as const,
        header: 'Cliente',
        render: (sale: DashboardSale) => {
          const variant = getBadgeVariant(sale.status);

          return (
            <div className="flex flex-col gap-1">
              <span className="font-medium text-white">{sale.customer_name || '—'}</span>
              <span className="text-xs text-slate-400">{sale.customer_email || '—'}</span>
              {sale.customer_phone ? (
                <span className="text-xs text-slate-500">{sale.customer_phone}</span>
              ) : null}
              <span className="mt-1 inline-flex xl:hidden">
                <Badge variant={variant}>{STATUS_LABEL[variant] ?? sale.status}</Badge>
              </span>
            </div>
          );
        },
      },
      {
        key: 'product_name' as const,
        header: 'Produto',
        render: (sale: DashboardSale) => sale.product_name || '—',
      },
      {
        key: 'checkout_url' as const,
        header: 'Link do checkout',
        render: (sale: DashboardSale) =>
          sale.checkout_url ? (
            <a
              href={sale.checkout_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand hover:underline"
            >
              Acessar checkout
            </a>
          ) : (
            '—'
          ),
      },
      {
        key: 'created_at' as const,
        header: 'Criado em',
        render: (sale: DashboardSale) => formatSaoPaulo(sale.created_at),
      },
      {
        key: 'paid_at' as const,
        header: 'Pago em',
        render: (sale: DashboardSale) => formatSaoPaulo(sale.paid_at),
      },
      {
        key: 'status' as const,
        header: 'Status',
        className: 'hidden xl:table-cell',
        render: (sale: DashboardSale) => {
          const variant = getBadgeVariant(sale.status);
          return <Badge variant={variant}>{STATUS_LABEL[variant] ?? sale.status}</Badge>;
        },
      },
    ],
    [],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
      </div>

      <Table<DashboardSale>
        columns={columns}
        data={filteredSales}
        getRowKey={(sale) => sale.id}
        emptyMessage={EMPTY_MESSAGE_BY_STATUS[status]}
      />
    </section>
  );
}
