import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

const RESOURCE_TABLES: Record<string, string> = {
  sales: 'kfy_sales',
  products: 'kfy_products',
  customers: 'kfy_customers',
  subscriptions: 'kfy_subscriptions',
  enrollments: 'kfy_enrollments',
  payouts: 'kfy_payouts',
  coupons: 'kfy_coupons',
  refunds: 'kfy_refunds'
};

interface RunJobPayload {
  readonly jobId?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  let payload: RunJobPayload;
  try {
    payload = (await request.json()) as RunJobPayload;
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_payload', error: 'Payload inválido.' }, { status: 400 });
  }

  if (!payload.jobId) {
    return NextResponse.json({ ok: false, code: 'missing_job', error: 'Informe o ID do job.' }, { status: 400 });
  }

  try {
    const client = getServiceClient();
    const job = await loadJob(client, payload.jobId);
    if (!job) {
      return NextResponse.json({ ok: false, code: 'not_found', error: 'Job não encontrado.' }, { status: 404 });
    }

    if (job.type !== 'export') {
      return NextResponse.json({ ok: false, code: 'unsupported_job', error: 'Apenas jobs de exportação são suportados.' }, { status: 400 });
    }

    if (job.status === 'completed') {
      return NextResponse.json({ ok: true, progressed: false, status: job.status, result_url: job.result_url ?? null });
    }

    const table = RESOURCE_TABLES[job.resource];
    if (!table) {
      return NextResponse.json({ ok: false, code: 'invalid_resource', error: 'Recurso não suportado.' }, { status: 400 });
    }

    await updateJobStatus(client, job.id, 'running');

    const rows = await fetchAllRows(client, table);
    const format = (job.params?.format as string) === 'csv' ? 'csv' : 'json';
    const content = format === 'csv' ? convertToCsv(rows) : JSON.stringify(rows, null, 2);

    const path = `exports/${job.id}.${format}`;
    await ensureBucket(client, 'exports');
    await uploadFile(client, 'exports', path, content, format === 'csv' ? 'text/csv' : 'application/json');
    const url = await createSignedUrl(client, 'exports', path);

    await finalizeJob(client, job.id, url);

    return NextResponse.json({ ok: true, progressed: true, status: 'completed', result_url: url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao executar job.';
    return NextResponse.json({ ok: false, code: 'job_run_failed', error: message }, { status: 500 });
  }
}

async function loadJob(client: ReturnType<typeof getServiceClient>, jobId: string) {
  const { data, error } = await client
    .from('jobs')
    .select('id, type, resource, status, params, result_url')
    .eq('id', jobId)
    .limit(1);
  if (error) {
    throw new Error(`Falha ao carregar job: ${error.message ?? 'erro desconhecido'}`);
  }
  return data?.[0] ?? null;
}

async function updateJobStatus(client: ReturnType<typeof getServiceClient>, jobId: string, status: string) {
  const { error } = await client.from('jobs').update({ status, updated_at: new Date().toISOString() }).eq('id', jobId);
  if (error) {
    throw new Error(`Falha ao atualizar job: ${error.message ?? 'erro desconhecido'}`);
  }
}

async function fetchAllRows(client: ReturnType<typeof getServiceClient>, table: string) {
  const { data, error } = await client.from(table).select('*');
  if (error) {
    throw new Error(`Falha ao ler dados para exportação: ${error.message ?? 'erro desconhecido'}`);
  }
  return data ?? [];
}

function convertToCsv(rows: any[]): string {
  if (rows.length === 0) {
    return '';
  }
  const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    if (str.includes(';') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.join(';')];
  for (const row of rows) {
    const line = headers.map(header => escape((row as Record<string, unknown>)[header])).join(';');
    lines.push(line);
  }
  return lines.join('\n');
}

async function ensureBucket(client: ReturnType<typeof getServiceClient>, bucket: string) {
  const { data, error } = await client.storage.getBucket(bucket);
  if (error && error.message && !error.message.includes('not found')) {
    throw new Error(`Falha ao verificar bucket: ${error.message}`);
  }
  if (!data) {
    const { error: createError } = await client.storage.createBucket(bucket, { public: false });
    if (createError) {
      throw new Error(`Falha ao criar bucket: ${createError.message}`);
    }
  }
}

async function uploadFile(
  client: ReturnType<typeof getServiceClient>,
  bucket: string,
  path: string,
  content: string,
  contentType: string
) {
  const { error } = await client.storage.from(bucket).upload(path, new Blob([content]), {
    upsert: true,
    contentType
  });
  if (error) {
    throw new Error(`Falha ao enviar arquivo: ${error.message}`);
  }
}

async function createSignedUrl(client: ReturnType<typeof getServiceClient>, bucket: string, path: string): Promise<string> {
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) {
    throw new Error(`Falha ao gerar URL assinada: ${error?.message ?? 'erro desconhecido'}`);
  }
  return data.signedUrl;
}

async function finalizeJob(client: ReturnType<typeof getServiceClient>, jobId: string, url: string) {
  const { error } = await client
    .from('jobs')
    .update({ status: 'completed', result_url: url, updated_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) {
    throw new Error(`Falha ao finalizar job: ${error.message ?? 'erro desconhecido'}`);
  }
}
