import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface CreateNotePayload {
  readonly entity_type?: string;
  readonly entity_id?: string;
  readonly body?: string;
  readonly author?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const entityType = params.get('entity_type');
  const entityId = params.get('entity_id');
  const limit = Math.min(Math.max(1, Number.parseInt(params.get('limit') ?? '20', 10) || 20), 100);

  if (!entityType || !entityId) {
    return NextResponse.json({ ok: false, code: 'missing_filters', error: 'Informe o tipo e o identificador da entidade.' }, { status: 400 });
  }

  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from('app_notes')
      .select('id, entity_type, entity_id, body, author, created_at')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao listar notas.';
    return NextResponse.json({ ok: false, code: 'notes_failed', error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  let payload: CreateNotePayload;
  try {
    payload = (await request.json()) as CreateNotePayload;
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_payload', error: 'Payload inválido.' }, { status: 400 });
  }

  if (!payload.entity_type || !payload.entity_id || !payload.body) {
    return NextResponse.json(
      { ok: false, code: 'missing_fields', error: 'entity_type, entity_id e body são obrigatórios.' },
      { status: 400 }
    );
  }

  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from('app_notes')
      .insert({
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        body: payload.body,
        author: payload.author ?? null
      })
      .select('id, entity_type, entity_id, body, author, created_at')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, note: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao criar nota.';
    return NextResponse.json({ ok: false, code: 'note_create_failed', error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ ok: false, code: 'missing_id', error: 'Informe o ID da nota.' }, { status: 400 });
  }

  try {
    const client = getServiceClient();
    const { error } = await client.from('app_notes').delete().eq('id', id);
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao remover nota.';
    return NextResponse.json({ ok: false, code: 'note_delete_failed', error: message }, { status: 500 });
  }
}
