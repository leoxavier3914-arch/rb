import { NextRequest, NextResponse } from 'next/server';

import { assertIsAdmin } from '@/lib/auth';
import { getSupabaseAdmin, hasSupabaseConfig } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  await assertIsAdmin(request);

  if (!hasSupabaseConfig()) {
    return NextResponse.json({
      totals: { grossCents: 0, count: 0 },
      statusCounts: {},
    });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('kfy_sales')
    .select('status,total_amount_cents');

  if (error) {
    console.error('Erro ao carregar estatísticas do hub', error);
    return NextResponse.json({ error: 'stats_query_failed' }, { status: 500 });
  }

  const totals = { grossCents: 0, count: 0 };
  const statusCounts = new Map<string, number>();

  for (const row of data ?? []) {
    totals.count += 1;
    totals.grossCents += Number(row.total_amount_cents ?? 0) || 0;
    const status = typeof row.status === 'string' ? row.status : 'unknown';
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }

  return NextResponse.json({
    totals,
    statusCounts: Object.fromEntries(statusCounts.entries()),
  });
}

