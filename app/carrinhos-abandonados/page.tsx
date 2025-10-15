import Card from '../../components/Card';
import AbandonedCartsSection from '../../components/AbandonedCartsSection';
import { fetchAbandonedCarts } from '../../lib/abandonedCarts';
import { getBadgeVariant } from '../../lib/status';
import type { AbandonedCart } from '../../lib/types';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import type { BadgeVariant } from '../../components/Badge';

export const dynamic = 'force-dynamic';

type StatusKey = Extract<BadgeVariant, 'new' | 'pending' | 'abandoned' | 'approved' | 'refunded' | 'refused'>;

type StatusCardConfig = {
  key: StatusKey;
  title: string;
  description: string;
};

const STATUS_CARD_CONFIG: StatusCardConfig[] = [
  {
    key: 'approved',
    title: 'Pagamentos aprovados',
    description: 'Pedidos confirmados automaticamente após o checkout.',
  },
  {
    key: 'pending',
    title: 'Aguardando pagamento',
    description: 'Carrinhos com PIX ou boleto aguardando confirmação.',
  },
  {
    key: 'abandoned',
    title: 'Carrinhos abandonados',
    description: 'Intenções sem pagamento após 1 hora da criação.',
  },
  {
    key: 'refused',
    title: 'Pagamentos recusados',
    description: 'Tentativas negadas pelo meio de pagamento.',
  },
  {
    key: 'refunded',
    title: 'Pagamentos reembolsados',
    description: 'Pedidos com devolução do valor ao cliente.',
  },
  {
    key: 'new',
    title: 'Novos carrinhos',
    description: 'Eventos recebidos nos últimos minutos.',
  },
];

const INITIAL_STATUS_COUNTS: Record<StatusKey, number> = {
  approved: 0,
  pending: 0,
  abandoned: 0,
  refused: 0,
  refunded: 0,
  new: 0,
};

const countByStatus = (carts: AbandonedCart[]) => {
  return carts.reduce<Record<StatusKey, number>>((acc, cart) => {
    const variant = getBadgeVariant(cart.status);
    if (variant in acc) {
      const key = variant as StatusKey;
      acc[key] = (acc[key] ?? 0) + 1;
    }
    return acc;
  }, { ...INITIAL_STATUS_COUNTS });
};

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
  const statusCounts = countByStatus(carts);
  const expiredCount = countExpiredLinks(carts);

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold">Carrinhos abandonados</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Monitore o desempenho dos carrinhos ao longo do funil, identifique pagamentos aprovados e acompanhe ações que
          precisam de recuperação manual.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Carrinhos monitorados" value={carts.length} description="Total de registros analisados." />
        {STATUS_CARD_CONFIG.map((card) => (
          <Card key={card.key} title={card.title} value={statusCounts[card.key]} description={card.description} />
        ))}
      </section>

      <AbandonedCartsSection carts={carts} expiredCount={expiredCount} />
    </main>
  );
}
