import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { fetchBalances } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  try {
    const balances = await fetchBalances();
    return NextResponse.json({ ok: true, data: balances });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao consultar saldos.', 'balances_fetch_failed');
  }
}
