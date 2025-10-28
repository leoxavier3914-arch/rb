import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { listProducts } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';
import { parseNumberParam } from '@/lib/utils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const pageSize = parseNumberParam(params.get('page_size'));
  const page = parseNumberParam(params.get('page'));

  try {
    const products = await listProducts({ pageSize, page });
    return NextResponse.json({ ok: true, data: products });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao listar produtos.', 'products_list_failed');
  }
}
