import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { fetchSalesStats } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const startDate = params.get('start_date');
  const endDate = params.get('end_date');
  const productId = params.get('product_id') ?? undefined;

  if (!startDate || !endDate) {
    return NextResponse.json(
      { ok: false, code: 'sales_stats_invalid_params', error: 'Os parâmetros start_date e end_date são obrigatórios.' },
      { status: 400 }
    );
  }

  try {
    const stats = await fetchSalesStats({ startDate, endDate, productId });
    return NextResponse.json({ ok: true, data: stats });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao consultar estatísticas de vendas.', 'sales_stats_failed');
  }
}
