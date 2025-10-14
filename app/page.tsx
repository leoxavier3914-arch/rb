// app/page.tsx
import Card from '../components/Card';
import AbandonedCartsSection from '../components/AbandonedCartsSection';
import { fetchAbandonedCarts } from '../lib/abandonedCarts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import type { AbandonedCart } from '../lib/types';
import { parsePgTimestamp } from '../lib/dates';

export const dynamic = 'force-dynamic';

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
        <Card title="Total de registros" value={metrics.total} description="Todos os carrinhos recebidos" />
        <Card title="Pendentes" value={metrics.pending} description="Aguardando envio de e-mail" />
        <Card title="E-mails enviados" value={metrics.sent} description="Lembretes já disparados" />
        <Card title="Convertidos" value={metrics.converted} description="Clientes que finalizaram a compra" />
      </section>

      <AbandonedCartsSection carts={carts} expiredCount={metrics.expired} />
    </main>
  );
}
