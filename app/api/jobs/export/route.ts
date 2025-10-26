import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  return NextResponse.json(
    { ok: false, code: 'not_implemented', error: 'Criação de job de exportação não implementada.' },
    { status: 501 }
  );
}
