import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

const ALLOWED_RESOURCES = new Set([
  'sales',
  'products',
  'customers',
  'subscriptions',
  'enrollments',
  'payouts',
  'coupons',
  'refunds'
]);

interface CreateJobPayload {
  readonly resource?: string;
  readonly format?: 'csv' | 'json';
  readonly params?: Record<string, unknown>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  let payload: CreateJobPayload;
  try {
    payload = (await request.json()) as CreateJobPayload;
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_payload', error: 'Payload inválido.' }, { status: 400 });
  }

  if (!payload.resource || !ALLOWED_RESOURCES.has(payload.resource)) {
    return NextResponse.json({ ok: false, code: 'invalid_resource', error: 'Recurso de exportação inválido.' }, { status: 400 });
  }

  const format = payload.format ?? 'json';
  if (!['csv', 'json'].includes(format)) {
    return NextResponse.json({ ok: false, code: 'invalid_format', error: 'Formato de exportação inválido.' }, { status: 400 });
  }

  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from('jobs')
      .insert({
        type: 'export',
        resource: payload.resource,
        status: 'queued',
        params: { format, params: payload.params ?? {} }
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, jobId: data?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao criar job.';
    return NextResponse.json({ ok: false, code: 'job_create_failed', error: message }, { status: 500 });
  }
}
