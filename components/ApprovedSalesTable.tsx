'use client';

import { useMemo } from 'react';
import Badge from './Badge';
import Table from './Table';
import { formatSaoPaulo } from '../lib/dates';
import { getBadgeVariant, STATUS_LABEL } from '../lib/status';
import type { Sale } from '../lib/types';

export const EMPTY_MESSAGE = 'Nenhuma venda aprovada encontrada.';

export const filterApprovedSales = (sales: Sale[]): Sale[] =>
  sales.filter((sale) => sale.status === 'approved');

type ApprovedSalesTableProps = {
  sales: Sale[];
};

export default function ApprovedSalesTable({ sales }: ApprovedSalesTableProps) {
  const approvedSales = useMemo(() => filterApprovedSales(sales), [sales]);

  const columns = useMemo(
    () => [
      {
        key: 'customer' as const,
        header: 'Cliente',
        render: (sale: Sale) => {
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
        render: (sale: Sale) => sale.product_name || '—',
      },
      {
        key: 'checkout_url' as const,
        header: 'Link do checkout',
        render: (sale: Sale) =>
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
        render: (sale: Sale) => formatSaoPaulo(sale.created_at),
      },
      {
        key: 'paid_at' as const,
        header: 'Pago em',
        render: (sale: Sale) => formatSaoPaulo(sale.paid_at),
      },
      {
        key: 'status' as const,
        header: 'Status',
        className: 'hidden xl:table-cell',
        render: (sale: Sale) => {
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
          <h2 className="text-xl font-semibold">Pagamentos aprovados</h2>
          <p className="text-sm text-slate-400">
            Utilize os dados do checkout para acompanhar quais clientes concluíram o pagamento.
          </p>
        </div>
      </div>

      <Table<Sale>
        columns={columns}
        data={approvedSales}
        getRowKey={(sale) => sale.id}
        emptyMessage={EMPTY_MESSAGE}
      />
    </section>
  );
}
