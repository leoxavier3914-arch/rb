import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { assertIsAdmin } from '@/lib/auth';
import { getSupabaseAdmin, hasSupabaseConfig } from '@/lib/supabase';

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(100),
  status: z.string().optional(),
});

const saleSchema = z.object({
  id: z.string(),
  status: z.string().nullable(),
  customer_id: z.string().nullable(),
  total_amount_cents: z.number().nullable(),
  created_at: z.string().nullable(),
  paid_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export async function GET(request: NextRequest) {
  await assertIsAdmin(request);

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ items: [] });
  }

  const params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('kfy_sales')
    .select('id,status,customer_id,total_amount_cents,created_at,paid_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(params.limit);

  if (params.status) {
    query = query.in('status', params.status.split(','));
  }

  const { data, error } = await query;
  if (error) {
    console.error('Erro ao consultar vendas do hub', error);
    return NextResponse.json({ error: 'sales_query_failed' }, { status: 500 });
  }

  const rows = z.array(saleSchema).parse(data ?? []);

  return NextResponse.json({
    items: rows.map(row => ({
      id: row.id,
      status: row.status,
      customerId: row.customer_id,
      totalAmountCents: row.total_amount_cents ?? 0,
      createdAt: row.created_at,
      paidAt: row.paid_at,
      updatedAt: row.updated_at,
    })),
  });
}

