import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { refundSale } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { readonly params: { readonly saleId: string } }
): Promise<NextResponse> {
  assertIsAdmin(request);

  let pixKey: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.pix_key === 'string') {
      pixKey = body.pix_key;
    } else if (typeof body.pixKey === 'string') {
      pixKey = body.pixKey;
    }
  } catch {
    pixKey = undefined;
  }

  try {
    const result = await refundSale(params.saleId, { pixKey });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao reembolsar venda.', 'sale_refund_failed');
  }
}
