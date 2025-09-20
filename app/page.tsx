// app/page.tsx
import Card from '../components/Card';
import Badge, { type BadgeVariant } from '../components/Badge';
import Table from '../components/Table';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<BadgeVariant, string> = {
  pending: 'Pendente',
  sent: 'E-mail enviado',
  converted: 'Convertido',
  error: 'Erro',
};
const badgeVariants = new Set<BadgeVariant>(['pending', 'sent', 'converted', 'error']);

type AbandonedCart = {
  id: string;
  customer_email: string;
  customer_name: string | null;
  product_name: string | null;
  product_id: string | null;
  status: string;
  discount_code: string | null;
  expires_at: string | null;        // schedule_at / expires_at
  last_event: string | null;
  last_reminder_at: string | null;  // sent_at
  created_at: string | null;
  updated_at: string | null;
};

/* ========= Normalização UTC do timestamp do Postgres =========
   Aceita:
   - "YYYY-MM-DD HH:MM:SS.mmmmmm+00"
   - "YYYY-MM-DD HH:MM:SS.mmm+0000"
   - "YYYY-MM-DD HH:MM:SS.mmm+00:00"
   - "YYYY-MM-DD HH:MM:SSZ"
   - sem offset → assume UTC
*/
function parsePgTimestamp(value?: string | null): Date | null {
  if (!value) return null;
  let s = String(value).trim();

  // 1) ISO-like
  s = s.replace(' ', 'T');

  // 2) micros → millis (3 dígitos)
  s = s.replace(/(\.\d{3})\d+/, '$1');

  // 3) normaliza timezone final
  const tz = s.match(/([+\-]\d{2})(?::?(\d{2}))?$/);
  if (tz) {
    const sign = tz[1][0];
    const hh = tz[1].slice(1);
    const mm = tz[2] ?? '00';
    if (hh === '00' && mm === '00') {
      s = s.replace(/([+\-]\d{2})(?::?(\d{2}))?$/, 'Z'); // +00 / +0000 / +00:00 → Z
    } else {
      s = s.replace(/([+\-]\d{2})(?::?(\d{2}))?$/, `${sign}${hh}:${mm}`); // força +HH:MM
    }
  } else if (!/[Zz]$/.test(s)) {
    s += 'Z'; // sem offset → assume UTC
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Formata SEMPRE no fuso de São Paulo (consistente p/ todos os devices)
function formatSaoPaulo(value: string | null) {
  const d = parsePgTimestamp(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

function getBadgeVariant(status: string): BadgeVariant {
  return badgeVariants.has(status as BadgeVariant) ? (status as BadgeVariant) : 'error';
}

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
        status: r.status || 'pending',
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

        <Table
          columns={[
            {
              key: 'customer_name',
              header: 'Cliente',
              render: (item) => (
                <div className="flex flex-col">
                  <span className="font-medium text-white">
                    {item.customer_name ?? 'Nome não informado'}
                  </span>
                  <span className="text-xs text-slate-400">{item.customer_email}</span>
                </div>
              ),
            },
            { key: 'product_name', header: 'Produto', render: (i) => i.product_name ?? '—' },
            {
              key: 'status',
              header: 'Status',
              render: (i) => {
                const variant = getBadgeVariant(i.status);
                return <Badge variant={variant}>{STATUS_LABEL[variant] ?? i.status}</Badge>;
              },
            },
            { key: 'discount_code', header: 'Cupom', render: (i) => i.discount_code ?? '—' },
            { key: 'expires_at', header: 'Expira em', render: (i) => formatSaoPaulo(i.expires_at) },
            { key: 'updated_at', header: 'Atualizado em', render: (i) => formatSaoPaulo(i.updated_at ?? i.created_at) },
          ]}
          data={carts}
          getRowKey={(i) => i.id}
          emptyMessage="Nenhum evento encontrado. Aguarde o primeiro webhook da Kiwify."
        />
      </section>
    </main>
  );
}
