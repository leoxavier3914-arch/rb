import { NextResponse } from 'next/server';
import { deleteWebhook, updateWebhook } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

function normalizeEvents(value: unknown): string[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(item => item.length > 0);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id?: string } }
) {
  const id = typeof params?.id === 'string' ? params.id : '';
  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Informe o webhook que deseja atualizar.' },
      { status: 400 }
    );
  }

  try {
    const payload = (await request.json().catch(() => null)) as
      | { url?: unknown; events?: unknown; status?: unknown; secret?: unknown }
      | null;

    if (!payload ||
      (payload.url === undefined &&
        payload.events === undefined &&
        payload.status === undefined &&
        payload.secret === undefined)) {
      return NextResponse.json(
        { ok: false, error: 'Informe ao menos um campo para atualizar o webhook.' },
        { status: 400 }
      );
    }

    const url = typeof payload.url === 'string' ? payload.url.trim() : undefined;
    if (payload.url !== undefined && (!url || url.length === 0)) {
      return NextResponse.json(
        { ok: false, error: 'Informe uma URL válida para o webhook.' },
        { status: 400 }
      );
    }

    const events = normalizeEvents(payload.events);
    if (events === null) {
      return NextResponse.json(
        { ok: false, error: 'Informe os eventos como uma lista válida.' },
        { status: 400 }
      );
    }
    if (events !== undefined && events.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Informe pelo menos um evento para o webhook.' },
        { status: 400 }
      );
    }

    const status = typeof payload.status === 'string' ? payload.status.trim() : undefined;
    if (payload.status !== undefined && (!status || status.length === 0)) {
      return NextResponse.json(
        { ok: false, error: 'Informe um status válido para o webhook.' },
        { status: 400 }
      );
    }
    const secret = typeof payload.secret === 'string' ? payload.secret : undefined;

    const webhook = await updateWebhook(id, { url, events, status, secret });
    return NextResponse.json({ ok: true, webhook });
  } catch (error) {
    console.error('update_webhook_failed', error);
    const message = error instanceof Error ? error.message : 'Não foi possível atualizar o webhook agora.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id?: string } }
) {
  const id = typeof params?.id === 'string' ? params.id : '';
  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Informe o webhook que deseja excluir.' },
      { status: 400 }
    );
  }

  try {
    await deleteWebhook(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('delete_webhook_failed', error);
    const message = error instanceof Error ? error.message : 'Não foi possível excluir o webhook agora.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
