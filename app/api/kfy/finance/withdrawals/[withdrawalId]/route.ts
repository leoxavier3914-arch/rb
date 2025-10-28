import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { getWithdrawal } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { readonly params: { readonly withdrawalId: string } }
): Promise<NextResponse> {
  assertIsAdmin(request);

  try {
    const withdrawal = await getWithdrawal(params.withdrawalId);
    return NextResponse.json({ ok: true, data: withdrawal });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao consultar saque.', 'withdrawal_fetch_failed');
  }
}
