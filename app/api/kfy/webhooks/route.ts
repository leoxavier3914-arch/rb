import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { listWebhooks, createWebhook, type UpsertWebhookPayload } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';
import { parseNumberParam } from '@/lib/utils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const pageSize = parseNumberParam(params.get('page_size'));
  const page = parseNumberParam(params.get('page'));
  const productId = params.get('product_id') ?? undefined;
  const search = params.get('search') ?? undefined;

  try {
    const webhooks = await listWebhooks({ pageSize, page, productId, search });
    return NextResponse.json({ ok: true, data: webhooks });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao listar webhooks.', 'webhooks_list_failed');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const payload = normalizeWebhookPayload(body);
  if (!payload) {
    return NextResponse.json(
      {
        ok: false,
        code: 'webhook_create_invalid',
        error: 'Nome, URL e triggers são obrigatórios.'
      },
      { status: 400 }
    );
  }

  try {
    const result = await createWebhook(payload);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao criar webhook.', 'webhook_create_failed');
  }
}

function normalizeWebhookPayload(body: Record<string, unknown>): UpsertWebhookPayload | null {
  const name = typeof body.name === 'string' ? body.name : typeof body.nome === 'string' ? body.nome : null;
  const url = typeof body.url === 'string' ? body.url : typeof body.webhook_url === 'string' ? body.webhook_url : null;
  const products = typeof body.products === 'string' ? body.products : undefined;
  const token = typeof body.token === 'string' ? body.token : undefined;
  let triggers: string[] | null = null;

  if (Array.isArray(body.triggers) && body.triggers.every(item => typeof item === 'string')) {
    triggers = body.triggers as string[];
  } else if (typeof body.triggers === 'string') {
    triggers = body.triggers
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean);
  }

  if (!name || !url || !triggers || triggers.length === 0) {
    return null;
  }

  return { name, url, products, triggers, token };
}
