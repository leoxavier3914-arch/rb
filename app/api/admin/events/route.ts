// app/api/admin/events/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
}
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_TOKEN = (process.env.ADMIN_TOKEN ?? '').trim();

export async function GET(req: Request) {
  // auth simples igual às outras rotas admin
  if (ADMIN_TOKEN) {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token || token !== ADMIN_TOKEN) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // busca também o payload para usar como fallback
  const { data, error } = await supabase
    .from('abandoned_emails')
    .select('id,email,customer_name,product_title,checkout_url,discount_code,status,schedule_at,updated_at,source,payload')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[events] select error', error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  const items = (data ?? []).map((r: any) => {
    const p = r?.payload ?? {};
    const product =
      r.product_title ??
      p.product_name ??
      p.offer_name ??
      'Carrinho (Kiwify)';

    const checkout =
      r.checkout_url ??
      (p.checkout_link && /^[A-Za-z0-9]{5,20}$/.test(p.checkout_link)
        ? `https://pay.kiwify.com.br/${p.checkout_link}`
        : null);

    return {
      ...r,
      product_title: product,
      checkout_url: checkout,
      payload: undefined, // não expor
    };
  });

  return NextResponse.json(
    { ok: true, items },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
