import { listSales, getSalesSummary, listDailySales } from '@/lib/sales';
import { getBalance } from '@/lib/finance';

import DashboardPageContent from './DashboardPageContent';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [summary, recent, balance, dailySales] = await Promise.all([
    getSalesSummary(),
    listSales(1, 5, undefined, undefined),
    getBalance(),
    listDailySales()
  ]);

  return (
    <DashboardPageContent summary={summary} recent={recent} balance={balance} dailySales={dailySales} />
  );
}

