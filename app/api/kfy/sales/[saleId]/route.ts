import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { getSale } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { readonly params: { readonly saleId: string } }
): Promise<NextResponse> {
  assertIsAdmin(request);

  try {
    const sale = await getSale(params.saleId);
    return NextResponse.json({ ok: true, data: sale });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao consultar venda.', 'sale_fetch_failed');
  }
}
