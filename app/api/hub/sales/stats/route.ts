import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { buildDateClause } from '@/lib/hub/filters';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface SaleRow {
  readonly status: string | null;
  readonly total_amount_cents: number | null;
  readonly net_amount_cents: number | null;
  readonly fee_amount_cents: number | null;
  readonly paid_at: string | null;
  readonly created_at: string | null;
}

interface SalesStatsResponse {
  readonly gross_cents: number;
  readonly net_cents: number;
  readonly fee_cents: number;
  readonly approved_count: number;
  readonly pending_count: number;
  readonly refunded_count: number;
  readonly rejected_count: number;
  readonly total_count: number;
  readonly ticket_medio_cents: number;
  readonly approval_rate: number;
  readonly period: { readonly from: string; readonly to: string };
  readonly product_id: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const startDate = params.get('start_date');
  const endDate = params.get('end_date');
  const productId = params.get('product_id');

  if (!startDate || !endDate) {
    return NextResponse.json(
      {
        ok: false,
        code: 'sales_stats_invalid_params',
        error: 'Os parâmetros start_date e end_date são obrigatórios.'
      },
      { status: 400 }
    );
  }

  const from = parseDate(startDate);
  const to = parseDate(endDate);

  if (!from || !to) {
    return NextResponse.json(
      { ok: false, code: 'sales_stats_invalid_params', error: 'Período informado é inválido.' },
      { status: 400 }
    );
  }

  try {
    const client = getServiceClient();
    let builder = client
      .from('kfy_sales')
      .select('status, total_amount_cents, net_amount_cents, fee_amount_cents, paid_at, created_at');

    const clause = buildDateClause({ from, to });
    if (clause) {
      builder = builder.or(clause);
    }

    if (productId && productId.trim() !== '') {
      builder = builder.eq('product_id', productId.trim());
    }

    const { data, error } = await builder;

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as SaleRow[];
    const stats = computeStats(rows);

    return NextResponse.json({
      ok: true,
      data: {
        ...stats,
        period: { from: from.toISOString(), to: to.toISOString() },
        product_id: productId?.trim() ?? null
      } satisfies SalesStatsResponse
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao calcular estatísticas de vendas.';
    return NextResponse.json({ ok: false, code: 'sales_stats_failed', error: message }, { status: 500 });
  }
}

function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function computeStats(rows: readonly SaleRow[]) {
  let gross = 0;
  let net = 0;
  let fees = 0;
  let approved = 0;
  let pending = 0;
  let refunded = 0;
  let rejected = 0;

  for (const row of rows) {
    const status = (row.status ?? '').toLowerCase();
    const paid = Boolean(row.paid_at);

    if (status === 'refunded') {
      refunded += 1;
      continue;
    }

    if (status === 'rejected' || status === 'canceled' || status === 'chargeback') {
      rejected += 1;
      continue;
    }

    if (paid || status === 'approved' || status === 'paid') {
      approved += 1;
      gross += row.total_amount_cents ?? 0;
      net += row.net_amount_cents ?? 0;
      fees += row.fee_amount_cents ?? 0;
      continue;
    }

    pending += 1;
  }

  const total = rows.length;
  const ticketMedio = approved > 0 ? Math.round(gross / approved) : 0;
  const approvalRate = total > 0 ? Number(((approved / total) * 100).toFixed(2)) : 0;

  return {
    gross_cents: gross,
    net_cents: net,
    fee_cents: fees,
    approved_count: approved,
    pending_count: pending,
    refunded_count: refunded,
    rejected_count: rejected,
    total_count: total,
    ticket_medio_cents: ticketMedio,
    approval_rate: approvalRate
  } satisfies Omit<SalesStatsResponse, 'period' | 'product_id'>;
}
