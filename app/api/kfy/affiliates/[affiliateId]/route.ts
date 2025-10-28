import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { getAffiliate, updateAffiliate } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';
import { parseNumberParam } from '@/lib/utils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { readonly params: { readonly affiliateId: string } }
): Promise<NextResponse> {
  assertIsAdmin(request);

  try {
    const affiliate = await getAffiliate(params.affiliateId);
    return NextResponse.json({ ok: true, data: affiliate });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao consultar afiliado.', 'affiliate_fetch_failed');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { readonly params: { readonly affiliateId: string } }
): Promise<NextResponse> {
  assertIsAdmin(request);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  let commission: number | undefined;
  if (typeof body.commission === 'number' && Number.isFinite(body.commission)) {
    commission = body.commission;
  } else if (typeof body.commission === 'string') {
    commission = parseNumberParam(body.commission) ?? undefined;
  }
  const status = typeof body.status === 'string' ? body.status : undefined;

  try {
    const result = await updateAffiliate(params.affiliateId, { commission, status });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao editar afiliado.', 'affiliate_update_failed');
  }
}
