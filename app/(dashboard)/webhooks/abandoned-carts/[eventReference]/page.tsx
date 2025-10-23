import Link from "next/link";
import { notFound } from "next/navigation";

import SaleDetailsTabs, { type DetailItem } from "@/components/sale-details-tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { getAbandonedCartDetail, type AbandonedCart } from "@/lib/queries";
import { formatSaleStatus } from "@/lib/sale-event-metadata";

export const dynamic = "force-dynamic";

const formatAmountDisplay = (
  value: number | string | null | undefined,
  currency: string | null,
) => {
  const formatted = formatCurrency(value, currency);
  if (formatted) {
    return formatted;
  }

  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
};

const buildCartItems = (cart: AbandonedCart): DetailItem[] => {
  const checkoutDisplay = cart.checkout_url ?? cart.cart_id ?? cart.event_reference;
  const statusDisplay = formatSaleStatus(cart.status) ?? cart.status ?? null;
  const occurredDisplay = formatDate(cart.occurred_at) ?? cart.occurred_at ?? null;
  const createdDisplay = formatDate(cart.created_at) ?? cart.created_at ?? null;

  const items: DetailItem[] = [
    { label: "Produto", value: cart.product_name },
    { label: "Checkout", value: checkoutDisplay },
  ];

  if (statusDisplay) {
    items.push({ label: "Status", value: statusDisplay });
  }

  if (occurredDisplay) {
    items.push({ label: "Abandonado em", value: occurredDisplay });
  }

  if (createdDisplay) {
    items.push({ label: "Registrado em", value: createdDisplay });
  }

  items.push({ label: "Referência do evento", value: cart.event_reference });

  if (cart.cart_id) {
    items.push({ label: "ID do carrinho", value: cart.cart_id });
  }

  return items;
};

const buildCustomerItems = (cart: AbandonedCart): DetailItem[] => {
  return [
    { label: "Nome", value: cart.customer_name },
    { label: "E-mail", value: cart.customer_email },
  ];
};

const buildValueItems = (cart: AbandonedCart): DetailItem[] => {
  const items: DetailItem[] = [];

  const net = formatAmountDisplay(cart.net_amount ?? cart.amount, cart.currency);
  if (net) {
    items.push({ label: "Potencial líquido", value: net });
  }

  const gross = formatAmountDisplay(cart.gross_amount ?? cart.amount, cart.currency);
  if (gross && gross !== net) {
    items.push({ label: "Valor cheio", value: gross });
  }

  const kiwify = formatAmountDisplay(cart.kiwify_commission_amount, cart.currency);
  if (kiwify) {
    items.push({ label: "Comissão Kiwify", value: kiwify });
  }

  const affiliate = formatAmountDisplay(cart.affiliate_commission_amount, cart.currency);
  if (affiliate) {
    items.push({ label: "Comissão de afiliados", value: affiliate });
  }

  if (cart.currency) {
    items.push({ label: "Moeda", value: cart.currency });
  }

  return items;
};

export default async function AbandonedCartDetailsPage({
  params,
}: {
  params: { eventReference: string };
}) {
  const reference = decodeURIComponent(params.eventReference);
  const cart = await getAbandonedCartDetail(reference);

  if (!cart) {
    notFound();
  }

  const sections = [
    { id: "cart", label: "Carrinho", items: buildCartItems(cart) },
    { id: "customer", label: "Cliente", items: buildCustomerItems(cart) },
    { id: "values", label: "Valores", items: buildValueItems(cart) },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Detalhes do carrinho
          </p>
          <h1 className="text-3xl font-semibold text-primary-foreground">
            {cart.product_name ?? "Carrinho abandonado"}
          </h1>
        </div>
        <Link
          href="/abandoned-carts"
          className="inline-flex items-center gap-2 rounded-full border border-surface-accent/60 bg-surface-accent px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
        >
          ← Voltar para o hub
        </Link>
      </header>

      <SaleDetailsTabs sections={sections} />

      <section className="rounded-3xl border border-surface-accent/20 bg-surface/50 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Payload bruto
        </h3>
        <pre className="mt-4 max-h-[480px] overflow-auto rounded-2xl bg-black/30 p-4 text-xs leading-relaxed text-muted-foreground">
          {JSON.stringify(cart.payload, null, 2)}
        </pre>
      </section>
    </div>
  );
}
