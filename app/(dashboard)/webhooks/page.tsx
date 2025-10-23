import Link from "next/link";

const pages = [
  {
    name: "Vendas aprovadas",
    description:
      "Confirmações recentes com valores líquidos, brutos e comissões detalhadas.",
    href: "/webhooks/approved-sales",
  },
  {
    name: "Pagamentos pendentes",
    description:
      "Cobranças em andamento aguardando confirmação de pagamento do cliente.",
    href: "/webhooks/pending-payments",
  },
  {
    name: "Pagamentos recusados",
    description:
      "Falhas e cancelamentos identificados pela Kiwify durante a cobrança.",
    href: "/webhooks/rejected-payments",
  },
  {
    name: "Reembolsos",
    description:
      "Histórico de devoluções efetivadas com valores liquidados e taxas.",
    href: "/webhooks/refunded-sales",
  },
  {
    name: "Carrinhos abandonados",
    description:
      "Clientes que iniciaram a compra, mas não concluíram o pagamento.",
    href: "/webhooks/abandoned-carts",
  },
];

export default function WebhooksPage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {pages.map((page) => (
        <Link
          key={page.href}
          href={page.href}
          className="group flex flex-col gap-3 rounded-2xl border border-surface-accent/50 bg-surface/70 p-5 transition-colors hover:border-primary/60 hover:bg-surface"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{page.name}</h3>
              <p className="text-sm text-muted-foreground">{page.description}</p>
            </div>
            <span className="rounded-full border border-surface-accent/60 bg-surface-accent px-3 py-1 text-xs font-medium text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
              Acessar
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
