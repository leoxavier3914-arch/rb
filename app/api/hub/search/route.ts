import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  return NextResponse.json(
    { ok: false, code: 'not_implemented', error: 'Busca global não implementada.' },
    { status: 501 }
  );
}
