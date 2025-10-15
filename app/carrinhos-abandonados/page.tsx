import Card from '../../components/Card';
import AbandonedCartsSection from '../../components/AbandonedCartsSection';
import { fetchAbandonedCarts } from '../../lib/abandonedCarts';
import { getBadgeVariant } from '../../lib/status';
import type { AbandonedCart } from '../../lib/types';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

const countExpiredLinks = (carts: AbandonedCart[]) => {
  const now = Date.now();

  return carts.reduce((acc, cart) => {
    if (!cart.expires_at) {
      return acc;
    }

    const expiresAt = Date.parse(cart.expires_at);
    if (Number.isNaN(expiresAt)) {
      return acc;
    }

    return expiresAt < now ? acc + 1 : acc;
  }, 0);
};

export default async function AbandonedCartsPage() {
  noStore();

  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');
  if (!adminToken || !token || token.value !== adminToken) {
    redirect('/login');
  }

  const carts = await fetchAbandonedCarts();
  const abandonedCarts = carts.filter((cart) => getBadgeVariant(cart.status) === 'abandoned');
  const expiredCount = countExpiredLinks(abandonedCarts);

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold">Carrinhos abandonados</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Monitore os carrinhos que não foram concluídos, identifique links expirados e priorize ações de recuperação.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Carrinhos abandonados monitorados"
          value={abandonedCarts.length}
          description="Total de registros marcados como abandonados."
        />
        <Card
          title="Links expirados"
          value={expiredCount}
          description="Checkouts que precisam de um novo link para recuperação."
        />
      </section>

      <AbandonedCartsSection carts={abandonedCarts} expiredCount={expiredCount} />
    </main>
  );
}
