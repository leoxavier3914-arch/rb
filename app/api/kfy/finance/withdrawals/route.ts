import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { listWithdrawals, createWithdrawal } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';
import { parseNumberParam } from '@/lib/utils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const legalEntityId = params.get('legal_entity_id') ?? undefined;
  const pageSize = parseNumberParam(params.get('page_size'));
  const page = parseNumberParam(params.get('page'));

  try {
    const withdrawals = await listWithdrawals({ legalEntityId, pageSize, page });
    return NextResponse.json({ ok: true, data: withdrawals });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao listar saques.', 'withdrawals_list_failed');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  let amount: number | undefined;
  if (typeof body.amount === 'number' && Number.isFinite(body.amount)) {
    amount = body.amount;
  } else if (typeof body.amount === 'string') {
    amount = parseNumberParam(body.amount) ?? undefined;
  }
  const legalEntityId = typeof body.legal_entity_id === 'string' ? body.legal_entity_id : undefined;

  if (!legalEntityId || amount === undefined) {
    return NextResponse.json(
      { ok: false, code: 'withdrawal_create_invalid', error: 'Valor e legal_entity_id são obrigatórios.' },
      { status: 400 }
    );
  }

  try {
    const result = await createWithdrawal({ amountCents: amount, legalEntityId });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao solicitar saque.', 'withdrawal_create_failed');
  }
}
