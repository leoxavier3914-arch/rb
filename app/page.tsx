// app/page.tsx
import Card from '../components/Card';
import AbandonedCartsSection from '../components/AbandonedCartsSection';
import { fetchAbandonedCarts } from '../lib/abandonedCarts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import type { AbandonedCart } from '../lib/types';
import { parsePgTimestamp } from '../lib/dates';
import { normalizeStatusToken, SENT_STATUS_TOKENS } from '../lib/normalization';

export const dynamic = 'force-dynamic';

function computeMetrics(carts: AbandonedCart[]) {
  const metrics = {
    total: carts.length,
    fresh: 0,
    pending: 0,
    contacted: 0,
    converted: 0,
    abandoned: 0,
    expired: 0,
  };

  const now = Date.now();

  for (const cart of carts) {
    switch (cart.status) {
      case 'new':
        metrics.fresh += 1;
        break;
      case 'pending':
        metrics.pending += 1;
        break;
      case 'converted':
        metrics.converted += 1;
        break;
      case 'abandoned':
        metrics.abandoned += 1;
        break;
      default:
        break;
    }

    const lastEventToken = normalizeStatusToken(cart.last_event);

    if (cart.last_reminder_at || (lastEventToken && SENT_STATUS_TOKENS.has(lastEventToken))) {
      metrics.contacted += 1;
    }

    const expiration = parsePgTimestamp(cart.expires_at);
    if (expiration && expiration.getTime() < now) {
      metrics.expired += 1;
    }
  }

  return metrics;
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

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <Card title="Total de registros" value={metrics.total} description="Todos os carrinhos recebidos" />
        <Card title="Novos" value={metrics.fresh} description="Eventos recém recebidos" />
        <Card title="Abandonados" value={metrics.abandoned} description="Carrinhos sem pagamento após 1 hora" />
        <Card
          title="Contatos realizados"
          value={metrics.contacted}
          description="Clientes que já receberam algum e-mail"
        />
        <Card title="Convertidos" value={metrics.converted} description="Clientes que finalizaram a compra" />
      </section>

      <AbandonedCartsSection carts={carts} expiredCount={metrics.expired} />
    </main>
  );
}
