import { SalesTablePage } from '@/components/sales/SalesTablePage';
import { parsePositiveIntegerParam } from '@/lib/ui/pagination';

export const dynamic = 'force-dynamic';

interface SalesPageProps {
  readonly searchParams?: Record<string, string | string[]>;
}

const PAGE_SIZE = 10;

export default async function VendasPage({ searchParams }: SalesPageProps) {
  const page = parsePositiveIntegerParam(searchParams?.page, 1);

  return (
    <SalesTablePage
      page={page}
      pageSize={PAGE_SIZE}
      statusFilter="paid"
      title="Vendas"
      description="Lista completa das vendas sincronizadas a partir da API da Kiwify. Cada página exibe 10 registros."
      tableTitle="Registros de vendas"
      emptyMessage='Nenhum dado sincronizado ainda. Acesse Configs e clique em "Sincronizar".'
      summaryLabel="vendas"
      basePath="/vendas"
    />
  );
}
