import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { listParticipants } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';
import { parseNumberParam, parseOptionalBoolean } from '@/lib/utils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const productId = params.get('product_id');
  if (!productId) {
    return NextResponse.json(
      { ok: false, code: 'participants_invalid_params', error: 'O parâmetro product_id é obrigatório.' },
      { status: 400 }
    );
  }

  const checkedIn = parseOptionalBoolean(params.get('checked_in'));
  const pageSize = parseNumberParam(params.get('page_size'));
  const page = parseNumberParam(params.get('page'));
  const createdAtStart = params.get('created_at_start') ?? undefined;
  const createdAtEnd = params.get('created_at_end') ?? undefined;
  const updatedAtStart = params.get('updated_at_start') ?? undefined;
  const updatedAtEnd = params.get('updated_at_end') ?? undefined;
  const externalId = params.get('external_id') ?? undefined;
  const batchId = params.get('batch_id') ?? undefined;
  const phone = params.get('phone') ?? undefined;
  const cpf = params.get('cpf') ?? undefined;
  const orderId = params.get('order_id') ?? undefined;

  try {
    const participants = await listParticipants({
      productId,
      checkedIn,
      pageSize,
      page,
      createdAtStart,
      createdAtEnd,
      updatedAtStart,
      updatedAtEnd,
      externalId,
      batchId,
      phone,
      cpf,
      orderId
    });
    return NextResponse.json({ ok: true, data: participants });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao listar participantes.', 'participants_list_failed');
  }
}
