import type { ReactNode } from "react";
import Link from "next/link";

const navigation = [
  { name: "Vendas aprovadas", href: "/webhooks/approved-sales" },
  { name: "Pagamentos pendentes", href: "/webhooks/pending-payments" },
  { name: "Pagamentos recusados", href: "/webhooks/rejected-payments" },
  { name: "Reembolsos", href: "/webhooks/refunded-sales" },
  { name: "Carrinhos abandonados", href: "/webhooks/abandoned-carts" },
];

export default function WebhooksLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white">Webhooks</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe todos os eventos recebidos pela Kiwify agrupados por
            categoria.
          </p>
        </div>
        <nav className="flex flex-nowrap gap-3 overflow-x-auto">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative whitespace-nowrap overflow-hidden rounded-full border border-surface-accent/60 bg-surface-accent px-5 py-2 text-sm font-medium text-muted-foreground shadow-lg shadow-black/20 transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              <span className="absolute inset-0 translate-y-[110%] bg-primary/20 transition-transform duration-300 ease-out group-hover:translate-y-0" />
              <span className="relative">{item.name}</span>
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
