import { SalesTablePage } from '@/components/sales/SalesTablePage';
import { parsePositiveIntegerParam } from '@/lib/ui/pagination';

export const dynamic = 'force-dynamic';

interface PendingPaymentsPageProps {
  readonly searchParams?: Record<string, string | string[]>;
}

const PAGE_SIZE = 10;
const pendingStatuses = ['waiting_payment'] as const;

export default async function PendingPaymentsPage({ searchParams }: PendingPaymentsPageProps) {
  const page = parsePositiveIntegerParam(searchParams?.page, 1);

  return (
    <SalesTablePage
      page={page}
      pageSize={PAGE_SIZE}
      statusFilter={pendingStatuses}
      title="Pagamentos pendentes"
      description="Pedidos aguardando confirmação de pagamento. Cada página exibe 10 registros."
      tableTitle="Registros pendentes"
      emptyMessage="Nenhum pagamento pendente no momento."
      summaryLabel="pagamentos pendentes"
      basePath="/pagamentos-pendentes"
    />
  );
}
