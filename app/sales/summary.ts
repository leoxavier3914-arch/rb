import type { Sale } from '../../lib/types';

export type SalesSummary = {
  total: number;
  approved: number;
  refunded: number;
  recovered: number;
  approvalRate: number;
};

export const buildSalesSummary = (sales: Sale[]): SalesSummary => {
  const total = sales.length;
  const approved = sales.filter((sale) => sale.status === 'approved').length;
  const refunded = sales.filter((sale) => sale.status === 'refunded').length;
  const recovered = sales.filter(
    (sale) => sale.status === 'approved' && sale.abandoned_before_payment,
  ).length;
  const approvalRate = total === 0 ? 0 : Math.round((approved / total) * 1000) / 10;

  return {
    total,
    approved,
    refunded,
    recovered,
    approvalRate,
  };
};
