import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { fetchBalanceByLegalEntity } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { readonly params: { readonly legalEntityId: string } }
): Promise<NextResponse> {
  assertIsAdmin(request);

  try {
    const balance = await fetchBalanceByLegalEntity(params.legalEntityId);
    return NextResponse.json({ ok: true, data: balance });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao consultar saldo específico.', 'balance_fetch_failed');
  }
}
