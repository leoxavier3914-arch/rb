import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface CreateViewPayload {
  readonly resource?: string;
  readonly name?: string;
  readonly filters?: unknown;
  readonly columns?: unknown;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from('saved_views')
      .select('id, resource, name, params, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao listar visões.';
    return NextResponse.json({ ok: false, code: 'views_failed', error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  let payload: CreateViewPayload;
  try {
    payload = (await request.json()) as CreateViewPayload;
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_payload', error: 'Payload inválido.' }, { status: 400 });
  }

  if (!payload.resource) {
    return NextResponse.json({ ok: false, code: 'missing_resource', error: 'Recurso é obrigatório.' }, { status: 400 });
  }

  const name = payload.name && payload.name.trim().length > 0 ? payload.name : `Visão ${new Date().toISOString()}`;
  const params = {
    filters: payload.filters ?? {},
    columns: payload.columns ?? []
  };

  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from('saved_views')
      .insert({ resource: payload.resource, name, params })
      .select('id')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, id: data?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao criar visão.';
    return NextResponse.json({ ok: false, code: 'view_create_failed', error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ ok: false, code: 'missing_id', error: 'Informe o ID da visão a remover.' }, { status: 400 });
  }

  try {
    const client = getServiceClient();
    const { error } = await client.from('saved_views').delete().eq('id', id);
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao remover visão.';
    return NextResponse.json({ ok: false, code: 'view_delete_failed', error: message }, { status: 500 });
  }
}
