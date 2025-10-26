import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { runBackfillDoctor } from '@/lib/kiwify/backfillDoctor';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  try {
    const report = await runBackfillDoctor();
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao executar auditoria do backfill.';
    return NextResponse.json({ ok: false, code: 'doctor_failed', error: message }, { status: 500 });
  }
}
