import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const navigation = [
  { name: "Visão geral", href: "/api" },
  { name: "Autenticação", href: "/api/authentication" },
  { name: "Conta", href: "/api/account" },
  { name: "Produtos", href: "/api/products" },
  { name: "Vendas", href: "/api/sales-overview" },
  { name: "Financeiro", href: "/api/financial" },
  { name: "Afiliados", href: "/api/affiliates" },
  { name: "Webhooks", href: "/api/webhooks" },
  { name: "Participantes", href: "/api/participants" },
];

export default function ApiLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white">API da Kiwify</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie produtos, vendas, alunos e finanças diretamente pelo hub seguindo o manual oficial da Kiwify.
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
