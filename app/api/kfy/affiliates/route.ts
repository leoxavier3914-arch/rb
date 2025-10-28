import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { listAffiliates } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';
import { parseNumberParam } from '@/lib/utils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const pageSize = parseNumberParam(params.get('page_size'));
  const page = parseNumberParam(params.get('page'));
  const status = params.get('status') ?? undefined;
  const productId = params.get('product_id') ?? undefined;
  const search = params.get('search') ?? undefined;

  try {
    const affiliates = await listAffiliates({ pageSize, page, status, productId, search });
    return NextResponse.json({ ok: true, data: affiliates });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao listar afiliados.', 'affiliates_list_failed');
  }
}
