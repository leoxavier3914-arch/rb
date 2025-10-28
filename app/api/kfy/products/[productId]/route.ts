import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { getProduct } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { readonly params: { readonly productId: string } }
): Promise<NextResponse> {
  assertIsAdmin(request);

  try {
    const product = await getProduct(params.productId);
    return NextResponse.json({ ok: true, data: product });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao consultar produto.', 'product_fetch_failed');
  }
}
