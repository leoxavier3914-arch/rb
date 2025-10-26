import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { parseBooleanFlag } from '@/lib/utils';
import { parsePagination } from '@/lib/hub/filters';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const pagination = parsePagination(params, 20);
  const q = params.get('q');
  const activeParam = params.get('active');
  const active = activeParam !== null ? parseBooleanFlag(activeParam) : null;

  try {
    const client = getServiceClient();
    let builder = client
      .from('kfy_products')
      .select('id, title, price_cents, currency, active, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (q) {
      builder = builder.ilike('title', `${q}%`);
    }

    if (active !== null) {
      builder = builder.eq('active', active);
    }

    const from = (pagination.page - 1) * pagination.pageSize;
    const to = from + pagination.pageSize - 1;
    const { data, error, count } = await builder.range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      page: pagination.page,
      page_size: pagination.pageSize,
      total: count ?? (data?.length ?? 0),
      items: data ?? []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao listar produtos.';
    return NextResponse.json({ ok: false, code: 'products_failed', error: message }, { status: 500 });
  }
}
