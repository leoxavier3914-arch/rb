import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

function notImplementedResponse(message: string): NextResponse {
  return NextResponse.json(
    { ok: false, code: 'not_implemented', error: message },
    { status: 501 }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);
  return notImplementedResponse('Listagem de visões salvas não implementada.');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);
  return notImplementedResponse('Criação de visão salva não implementada.');
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);
  return notImplementedResponse('Remoção de visão salva não implementada.');
}
