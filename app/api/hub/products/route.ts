import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { assertIsAdmin } from '@/lib/auth';
import { getSupabaseAdmin, hasSupabaseConfig } from '@/lib/supabase';

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

const productSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  price_cents: z.number().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

const decodeCursor = (cursor: string | undefined) => {
  if (!cursor) return null;
  const [updatedAt, id] = cursor.split('::');
  if (!updatedAt || !id) return null;
  return { updatedAt, id };
};

const encodeCursor = (row: { updated_at: string | null; id: string }) => `${row.updated_at ?? ''}::${row.id}`;

export async function GET(request: NextRequest) {
  await assertIsAdmin(request);

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const supabase = getSupabaseAdmin();
  const cursor = decodeCursor(params.cursor);

  let query = supabase
    .from('kfy_products')
    .select('id,title,price_cents,created_at,updated_at')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(params.limit + 1);

  if (cursor) {
    query = query.or(
      `and(updated_at.lt.${cursor.updatedAt}),and(updated_at.eq.${cursor.updatedAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error('Erro ao consultar produtos do hub', error);
    return NextResponse.json({ error: 'products_query_failed' }, { status: 500 });
  }

  const rows = z.array(productSchema).parse(data ?? []);
  const hasNext = rows.length > params.limit;
  const items = hasNext ? rows.slice(0, -1) : rows;

  return NextResponse.json({
    items: items.map(row => ({
      id: row.id,
      title: row.title,
      priceCents: row.price_cents ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    nextCursor: hasNext && items.length ? encodeCursor({ updated_at: items[items.length - 1].updated_at ?? '', id: items[items.length - 1].id }) : null,
  });
}

