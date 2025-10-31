import { NextResponse } from 'next/server';

import { upsertWebhookSetting } from '@/lib/webhooks/settings';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { id?: string } }
) {
  const webhookId = typeof params?.id === 'string' ? params.id.trim() : '';
  if (!webhookId) {
    return NextResponse.json({ ok: false, error: 'Informe o webhook que deseja atualizar.' }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Envie os dados em formato JSON válido.' }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ ok: false, error: 'Dados inválidos para atualizar o webhook.' }, { status: 400 });
  }

  const { active, token, name, url } = payload as {
    active?: unknown;
    token?: unknown;
    name?: unknown;
    url?: unknown;
  };

  if (typeof active !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'Informe se o webhook deve ficar ativo ou inativo.' }, { status: 400 });
  }

  const normalizedToken =
    typeof token === 'string' ? (token.trim().length > 0 ? token.trim() : null) : null;
  const normalizedName =
    typeof name === 'string' ? (name.trim().length > 0 ? name.trim() : null) : null;
  const normalizedUrl = typeof url === 'string' ? (url.trim().length > 0 ? url.trim() : null) : null;

  try {
    await upsertWebhookSetting({
      webhookId,
      isActive: active,
      token: normalizedToken,
      name: normalizedName,
      url: normalizedUrl
    });

    return NextResponse.json({ ok: true, active });
  } catch (error) {
    console.error('update_webhook_state_failed', error);
    const message =
      error instanceof Error ? error.message : 'Não foi possível atualizar o status local do webhook agora.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

