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
  product_name: string | null; // <- a tabela usa este campo, mapeamos a partir de product_title/payload
  product_id: string | null;
  status: string;
  discount_code: string | null;
  expires_at: string | null;        // <- mapeado de schedule_at
  last_event: string | null;
  last_reminder_at: string | null;  // (se existir sent_at, mapeamos)
  created_at: string | null;
  updated_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getBadgeVariant(status: string): BadgeVariant {
  return badgeVariants.has(status as BadgeVariant) ? (status as BadgeVariant) : 'error';
}

async function fetchAbandonedCarts(): Promise<AbandonedCart[]> {
  noStore();

  try {
    const supabase = getSupabaseAdmin();

    // Busque explicitamente os campos que precisamos + payload para fallback
    const { data, error } = await supabase
      .from('abandoned_emails')
      .select(
        [
          'id',
          'email',               // fallback para customer_email
          'customer_email',
          'customer_name',
          'product_title',       // fonte principal do produto
          'discount_code',
          'status',
          'schedule_at',         // vira expires_at
          'sent_at',             // vira last_reminder_at (se existir)
          'created_at',
          'updated_at',
          'payload',             // fallback: product_name/offer_name
        ].join(','),
      )
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[kiwify-hub] erro ao consultar carrinhos', error);
      return [];
    }

    const rows = (data ?? []) as any[];

    return rows.map((r): AbandonedCart => {
      const p = (r?.payload ?? {}) as Record<string, any>;
      const productFromPayload =
        (typeof p.product_name === 'string' && p.product_name.trim()) ? p.product_name.trim()
        : (typeof p.offer_name === 'string' && p.offer_name.trim()) ? p.offer_name.trim()
        : null;

      return {
        id: String(r.id),
        customer_email: r.customer_email || r.email || '',
        customer_name: r.customer_name ?? null,
        product_name: r.product_title || productFromPayload || null,
        product_id: null, // não usamos por enquanto
        status: r.status || 'pending',
        discount_code: r.discount_code ?? null,
        expires_at: r.schedule_at ?? null,
        last_event: null,
        last_reminder_at: r.sent_at ?? null,
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
  const pending = carts.filter((item) => item.status === 'pending').length;
  const sent = carts.filter((item) => item.status === 'sent').length;
  const converted = carts.filter((item) => item.status === 'converted').length;
  const expired = carts.filter((item) => {
    if (!item.expires_at) return false;
    return new Date(item.expires_at).getTime() < Date.now();
  }).length;

  return { total, pending, sent, converted, expired };
}

export default async function Home() {
  noStore();

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
                  <span className="font-medium text-white">{item.customer_name ?? 'Nome não informado'}</span>
                  <span className="text-xs text-slate-400">{item.customer_email}</span>
                </div>
              ),
            },
            {
              key: 'product_name',
              header: 'Produto',
              render: (item) => item.product_name ?? '—',
            },
            {
              key: 'status',
              header: 'Status',
              render: (item) => {
                const variant = getBadgeVariant(item.status);
                return <Badge variant={variant}>{STATUS_LABEL[variant] ?? item.status}</Badge>;
              },
            },
            {
              key: 'discount_code',
              header: 'Cupom',
              render: (item) => item.discount_code ?? '—',
            },
            {
              key: 'expires_at',
              header: 'Expira em',
              render: (item) => formatDate(item.expires_at),
            },
            {
              key: 'updated_at',
              header: 'Atualizado em',
              render: (item) => formatDate(item.updated_at ?? item.created_at),
            },
          ]}
          data={carts}
          getRowKey={(item) => item.id}
          emptyMessage="Nenhum evento encontrado. Aguarde o primeiro webhook da Kiwify."
        />
      </section>
    </main>
  );
}
