import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { listSales } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';
import { parseNumberParam, parseOptionalBoolean } from '@/lib/utils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const startDate = params.get('start_date');
  const endDate = params.get('end_date');
  const status = params.get('status') ?? undefined;
  const paymentMethod = params.get('payment_method') ?? undefined;
  const productId = params.get('product_id') ?? undefined;
  const fullDetails = parseOptionalBoolean(params.get('full_details'));
  const pageSize = parseNumberParam(params.get('page_size'));
  const page = parseNumberParam(params.get('page'));

  if (!startDate || !endDate) {
    return NextResponse.json(
      {
        ok: false,
        code: 'sales_invalid_params',
        error: 'Os parâmetros start_date e end_date são obrigatórios.'
      },
      { status: 400 }
    );
  }

  try {
    const sales = await listSales({
      startDate,
      endDate,
      status,
      paymentMethod,
      productId,
      fullDetails,
      pageSize,
      page
    });
    return NextResponse.json({ ok: true, data: sales });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao listar vendas.', 'sales_list_failed');
  }
}
