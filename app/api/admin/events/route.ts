// app/api/admin/events/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readEnvValue } from '../../../../lib/env';

export async function GET(req: Request) {
  const adminToken = readEnvValue('ADMIN_TOKEN');
  const supabaseUrl = readEnvValue('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const supabaseServiceRoleKey = readEnvValue(
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_ROLE',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_SECRET_KEY',
  );

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    const missingEnv: string[] = [];
    if (!supabaseUrl) missingEnv.push('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseServiceRoleKey)
      missingEnv.push('SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE');

    console.error('[events] missing environment variables', missingEnv);
    return NextResponse.json(
      { ok: false, error: 'configuration_error', missing: missingEnv },
      { status: 500 },
    );
  }

  // auth simples igual às outras rotas admin
  if (adminToken) {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token || token !== adminToken) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  // busca também o payload para usar como fallback
  const { data, error } = await supabase
    .from('abandoned_emails')
    .select(
      'id,email,customer_name,product_title,checkout_url,discount_code,status,schedule_at,updated_at,source,traffic_source,payload'
    )
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
