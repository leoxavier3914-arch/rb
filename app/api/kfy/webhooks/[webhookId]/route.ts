import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { getWebhook, updateWebhook, deleteWebhook, type UpsertWebhookPayload } from '@/lib/kiwify/api';
import { buildKiwifyErrorResponse } from '@/lib/kiwify/routeUtils';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { readonly params: { readonly webhookId: string } }
): Promise<NextResponse> {
  assertIsAdmin(request);

  try {
    const webhook = await getWebhook(params.webhookId);
    return NextResponse.json({ ok: true, data: webhook });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao consultar webhook.', 'webhook_fetch_failed');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { readonly params: { readonly webhookId: string } }
): Promise<NextResponse> {
  assertIsAdmin(request);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const payload = normalizeWebhookPayload(body);
  if (!payload) {
    return NextResponse.json(
      { ok: false, code: 'webhook_update_invalid', error: 'Nome, URL e triggers são obrigatórios.' },
      { status: 400 }
    );
  }

  try {
    const result = await updateWebhook(params.webhookId, payload);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao atualizar webhook.', 'webhook_update_failed');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { readonly params: { readonly webhookId: string } }
): Promise<NextResponse> {
  assertIsAdmin(request);

  try {
    const result = await deleteWebhook(params.webhookId);
    return NextResponse.json({ ok: true, data: result ?? { success: true } });
  } catch (error) {
    return buildKiwifyErrorResponse(error, 'Erro ao deletar webhook.', 'webhook_delete_failed');
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
