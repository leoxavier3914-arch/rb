import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { buildDateClause, parseDateFilters, parsePagination } from '@/lib/hub/filters';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface SaleRow {
  readonly id: string;
  readonly status: string | null;
  readonly total_amount_cents: number | null;
  readonly created_at: string | null;
  readonly paid_at: string | null;
  readonly customer_id: string | null;
}

interface CustomerRow {
  readonly id: string;
  readonly name: string | null;
  readonly email: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const pagination = parsePagination(params, 20);
  const dateFilters = parseDateFilters(params);
  const status = params.get('status');
  const productId = params.get('product_id');
  const query = params.get('q');

  try {
    const client = getServiceClient();
    let builder = client
      .from('kfy_sales')
      .select('id, status, total_amount_cents, created_at, paid_at, customer_id', { count: 'exact' })
      .order('paid_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (status) {
      builder = builder.eq('status', status);
    }

    if (productId) {
      builder = builder.eq('product_id', productId);
    }

    if (query) {
      builder = builder.ilike('id', `${query}%`);
    }

    const dateClause = buildDateClause(dateFilters);
    if (dateClause) {
      builder = builder.or(dateClause);
    }

    const from = (pagination.page - 1) * pagination.pageSize;
    const to = from + pagination.pageSize - 1;
    const { data, error, count } = await builder.range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as SaleRow[];
    const customers = await loadCustomers(client, rows);
    const items = rows.map(row => ({
      id: row.id,
      customer: customers.get(row.customer_id ?? '') ?? 'Cliente desconhecido',
      status: row.status ?? 'desconhecido',
      total_cents: row.total_amount_cents ?? 0,
      created_at: row.paid_at ?? row.created_at ?? new Date(0).toISOString()
    }));

    return NextResponse.json({
      ok: true,
      page: pagination.page,
      page_size: pagination.pageSize,
      total: count ?? items.length,
      items
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao listar vendas.';
    return NextResponse.json({ ok: false, code: 'sales_failed', error: message }, { status: 500 });
  }
}

async function loadCustomers(
  client: ReturnType<typeof getServiceClient>,
  sales: readonly SaleRow[]
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(sales.map(row => row.customer_id).filter((id): id is string => Boolean(id))));
  if (ids.length === 0) {
    return new Map();
  }
  const { data, error } = await client
    .from('kfy_customers')
    .select('id, name, email')
    .in('id', ids);

  if (error) {
    throw new Error(`Falha ao carregar clientes: ${error.message ?? 'erro desconhecido'}`);
  }

  const map = new Map<string, string>();
  for (const row of data as CustomerRow[]) {
    const label = row.name ?? row.email ?? 'Cliente sem nome';
    map.set(row.id, label);
  }
  return map;
}
