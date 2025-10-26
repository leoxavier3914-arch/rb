import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ ok: false, code: 'missing_job', error: 'Informe o ID do job.' }, { status: 400 });
  }

  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from('jobs')
      .select('id, status, result_url, error, updated_at')
      .eq('id', jobId)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    const job = data?.[0];
    if (!job) {
      return NextResponse.json({ ok: false, code: 'not_found', error: 'Job não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, status: job.status, result_url: job.result_url ?? null, error: job.error ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao consultar job.';
    return NextResponse.json({ ok: false, code: 'job_status_failed', error: message }, { status: 500 });
  }
}
