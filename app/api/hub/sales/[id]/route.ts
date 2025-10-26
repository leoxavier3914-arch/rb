import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface SaleParams {
  readonly params: { id: string };
}

export async function GET(request: NextRequest, context: SaleParams): Promise<NextResponse> {
  assertIsAdmin(request);

  return NextResponse.json(
    {
      ok: false,
      code: 'not_implemented',
      error: `Detalhe da venda ${context.params.id} não implementado.`
    },
    { status: 501 }
  );
}
