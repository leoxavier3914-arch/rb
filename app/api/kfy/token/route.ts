import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { getAccessToken } from '@/lib/kiwify/client';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  try {
    await getAccessToken(true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao renovar token.';
    return NextResponse.json({ ok: false, code: 'token_refresh_failed', error: message }, { status: 500 });
  }
}
