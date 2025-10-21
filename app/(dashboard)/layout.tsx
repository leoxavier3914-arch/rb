import Link from "next/link";
import { Suspense } from "react";

const navigation = [
  { name: "Estatísticas", href: "/analytics" },
  { name: "Produtos", href: "/products" },
  { name: "Assinaturas", href: "/subscriptions" },
  { name: "Marketing & Pixel", href: "/marketing" },
  { name: "Vendas aprovadas", href: "/approved-sales" },
  { name: "Pagamentos pendentes", href: "/pending-payments" },
  { name: "Pagamentos recusados", href: "/rejected-payments" },
  { name: "Reembolsos", href: "/refunded-sales" },
  { name: "Carrinhos abandonados", href: "/abandoned-carts" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background px-6 pb-10 pt-12 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-8 rounded-3xl bg-surface/80 p-8 shadow-soft backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
                Hub de vendas Kiwify
              </p>
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Romeike Beauty</h1>
            </div>
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
        </header>
        <main className="relative">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,hsla(183,72%,48%,0.18),transparent_60%)]" />
          <section className="rounded-3xl border border-surface-accent/40 bg-surface/90 p-8 shadow-soft">
            <Suspense fallback={<div className="animate-pulse text-muted-foreground">Carregando…</div>}>
              {children}
            </Suspense>
          </section>
        </main>
      </div>
    </div>
  );
}
