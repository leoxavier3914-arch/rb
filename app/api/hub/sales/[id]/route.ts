import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface RouteParams {
  readonly params: { id: string };
}

export async function GET(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  assertIsAdmin(request);

  const saleId = context.params.id;
  if (!saleId) {
    return NextResponse.json({ ok: false, code: 'invalid_sale', error: 'Identificador de venda inválido.' }, { status: 400 });
  }

  try {
    const client = getServiceClient();
    const sale = await loadSale(client, saleId);
    if (!sale) {
      return NextResponse.json({ ok: false, code: 'not_found', error: 'Venda não encontrada.' }, { status: 404 });
    }

    const [events, notes, versions] = await Promise.all([
      loadSaleEvents(client, saleId),
      loadNotes(client, saleId),
      loadVersions(client, saleId)
    ]);

    return NextResponse.json({ ok: true, sale, events, notes, versions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao carregar detalhes da venda.';
    return NextResponse.json({ ok: false, code: 'sale_detail_failed', error: message }, { status: 500 });
  }
}

async function loadSale(client: ReturnType<typeof getServiceClient>, saleId: string) {
  const { data, error } = await client
    .from('kfy_sales')
    .select(
      'id, status, total_amount_cents, net_amount_cents, fee_amount_cents, created_at, paid_at, updated_at, customer_id, product_id'
    )
    .eq('id', saleId)
    .limit(1);

  if (error) {
    throw new Error(`Falha ao carregar venda: ${error.message ?? 'erro desconhecido'}`);
  }

  const row = data?.[0];
  if (!row) {
    return null;
  }

  return {
    ...row,
    created_at: row.created_at ?? null,
    paid_at: row.paid_at ?? null
  };
}

async function loadSaleEvents(client: ReturnType<typeof getServiceClient>, saleId: string) {
  const { data, error } = await client
    .from('kfy_sale_events')
    .select('id, type, at, meta')
    .eq('sale_id', saleId)
    .order('at', { ascending: false });

  if (error) {
    throw new Error(`Falha ao carregar eventos da venda: ${error.message ?? 'erro desconhecido'}`);
  }

  return data ?? [];
}

async function loadNotes(client: ReturnType<typeof getServiceClient>, saleId: string) {
  const { data, error } = await client
    .from('app_notes')
    .select('id, body, author, created_at')
    .eq('entity_type', 'sale')
    .eq('entity_id', saleId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Falha ao carregar notas: ${error.message ?? 'erro desconhecido'}`);
  }

  return data ?? [];
}

async function loadVersions(client: ReturnType<typeof getServiceClient>, saleId: string) {
  const { data, error } = await client
    .from('entity_versions')
    .select('id, version, data, changed_at')
    .eq('entity_type', 'sale')
    .eq('entity_id', saleId)
    .order('version', { ascending: false });

  if (error) {
    throw new Error(`Falha ao carregar histórico da venda: ${error.message ?? 'erro desconhecido'}`);
  }

  return data ?? [];
}
