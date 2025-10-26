import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface SearchResultItem {
  readonly type: 'customer' | 'product' | 'sale';
  readonly id: string;
  readonly label: string;
  readonly sublabel: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const query = (params.get('q') ?? '').trim();
  if (query.length === 0) {
    return NextResponse.json({ ok: false, code: 'invalid_query', error: 'Informe um termo de busca.' }, { status: 400 });
  }

  const limitParam = Number.parseInt(params.get('limit') ?? '10', 10);
  const limit = Math.min(Math.max(1, Number.isFinite(limitParam) ? limitParam : 10), 15);

  try {
    const client = getServiceClient();
    const results: SearchResultItem[] = [];

    const customers = await searchCustomers(client, query, limit);
    results.push(...customers);

    if (results.length < limit) {
      const products = await searchProducts(client, query, limit - results.length);
      results.push(...products);
    }

    if (results.length < limit) {
      const sales = await searchSales(client, query, limit - results.length);
      results.push(...sales);
    }

    return NextResponse.json({ ok: true, items: results.slice(0, limit) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao executar busca.';
    return NextResponse.json({ ok: false, code: 'search_failed', error: message }, { status: 500 });
  }
}

async function searchCustomers(
  client: ReturnType<typeof getServiceClient>,
  query: string,
  limit: number
): Promise<SearchResultItem[]> {
  if (limit <= 0) {
    return [];
  }
  const pattern = `${query}%`;
  const { data, error } = await client
    .from('kfy_customers')
    .select('id, name, email')
    .or(`name.ilike.${pattern},email.ilike.${pattern}`)
    .limit(limit);

  if (error) {
    throw new Error(`Falha ao buscar clientes: ${error.message ?? 'erro desconhecido'}`);
  }

  return (data ?? []).map(row => ({
    type: 'customer' as const,
    id: row.id,
    label: row.name ?? row.email ?? 'Cliente sem nome',
    sublabel: row.email ?? ''
  }));
}

async function searchProducts(
  client: ReturnType<typeof getServiceClient>,
  query: string,
  limit: number
): Promise<SearchResultItem[]> {
  if (limit <= 0) {
    return [];
  }
  const pattern = `${query}%`;
  const { data, error } = await client
    .from('kfy_products')
    .select('id, title')
    .ilike('title', pattern)
    .limit(limit);

  if (error) {
    throw new Error(`Falha ao buscar produtos: ${error.message ?? 'erro desconhecido'}`);
  }

  return (data ?? []).map(row => ({
    type: 'product' as const,
    id: row.id,
    label: row.title ?? 'Produto sem título',
    sublabel: 'Produto'
  }));
}

async function searchSales(
  client: ReturnType<typeof getServiceClient>,
  query: string,
  limit: number
): Promise<SearchResultItem[]> {
  if (limit <= 0) {
    return [];
  }
  const pattern = `${query}%`;
  const { data, error } = await client
    .from('kfy_sales')
    .select('id, status, total_amount_cents')
    .ilike('id', pattern)
    .limit(limit);

  if (error) {
    throw new Error(`Falha ao buscar vendas: ${error.message ?? 'erro desconhecido'}`);
  }

  return (data ?? []).map(row => ({
    type: 'sale' as const,
    id: row.id,
    label: `Venda ${row.id}`,
    sublabel: row.status ? `Status: ${row.status}` : ''
  }));
}
