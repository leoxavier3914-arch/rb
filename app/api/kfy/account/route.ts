import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { fetchAccount } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  try {
    const account = await fetchAccount();
    return NextResponse.json({ ok: true, data: account });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao consultar detalhes da conta.', 'account_fetch_failed');
  }
}
