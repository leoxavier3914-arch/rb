// app/page.tsx
import Card from '../components/Card';
import Badge from '../components/Badge';
import AbandonedCartsTable from '../components/AbandonedCartsTable';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import type { AbandonedCart } from '../lib/types';
import { parsePgTimestamp } from '../lib/dates';

export const dynamic = 'force-dynamic';

const clean = (v: any) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s && s !== '-' && s !== '—' ? s : '';
};

async function fetchAbandonedCarts(): Promise<AbandonedCart[]> {
  noStore();
  try {
    const supabase = getSupabaseAdmin();

    // select('*') para não quebrar se o schema variar
    const { data, error } = await supabase
      .from('abandoned_emails')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[kiwify-hub] erro ao consultar carrinhos', error);
      return [];
    }

    const rows = (data ?? []) as any[];

    return rows.map((r): AbandonedCart => {
      const p = (r?.payload ?? {}) as Record<string, any>;
      const productFromPayload = clean(p.product_name) || clean(p.offer_name) || '';
      const paid = Boolean(r?.paid);
      const baseStatus = r?.status || 'pending';
      const normalizedStatus = paid ? 'converted' : baseStatus;

      return {
        id: String(r.id),
        customer_email: clean(r.customer_email) || clean(r.email) || '',
        customer_name: clean(r.customer_name) || null,
        product_name:
          clean(r.product_name) ||
          clean(r.product_title) ||
          productFromPayload ||
          null,
        product_id: r.product_id ?? null,
        status: normalizedStatus,
        paid,
        paid_at: r.paid_at ?? null,
        discount_code: clean(r.discount_code) || clean((p as any)?.coupon) || null,
        // expiração/agendamento: aceita expires_at ou schedule_at
        expires_at: r.expires_at ?? r.schedule_at ?? null,
        last_event: r.last_event ?? null,
        // quando foi enviado pela última vez (se houver)
        last_reminder_at: r.sent_at ?? r.last_reminder_at ?? null,
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? null,
      };
    });
  } catch (error) {
    console.error('[kiwify-hub] supabase indisponível', error);
    return [];
  }
}

function computeMetrics(carts: AbandonedCart[]) {
  const total = carts.length;
  const pending = carts.filter((i) => i.status === 'pending').length;
  const sent = carts.filter((i) => i.status === 'sent').length;
  const converted = carts.filter((i) => i.status === 'converted').length;

  const expired = carts.filter((i) => {
    const d = parsePgTimestamp(i.expires_at);
    return !!d && d.getTime() < Date.now();
  }).length;

  return { total, pending, sent, converted, expired };
}

export default async function Home() {
  noStore();

  // auth simples por cookie
  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');
  if (!adminToken || !token || token.value !== adminToken) {
    redirect('/login');
  }

  const carts = await fetchAbandonedCarts();
  const metrics = computeMetrics(carts);

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold">Carrinhos abandonados</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Visualize os eventos recebidos pela webhook da Kiwify e envie manualmente um novo lembrete com desconto.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Total de registros" value={metrics.total} description="Últimos 50 carrinhos recebidos" />
        <Card title="Pendentes" value={metrics.pending} description="Aguardando envio de e-mail" />
        <Card title="E-mails enviados" value={metrics.sent} description="Lembretes já disparados" />
        <Card title="Convertidos" value={metrics.converted} description="Clientes que finalizaram a compra" />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Últimos eventos</h2>
          <Badge variant={metrics.expired > 0 ? 'error' : 'pending'}>
            {metrics.expired > 0 ? `${metrics.expired} link(s) expirados` : 'Todos os links ativos'}
          </Badge>
        </div>

        <AbandonedCartsTable carts={carts} />
      </section>
    </main>
  );
}
