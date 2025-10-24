"use client";

interface SalesErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SalesError({ error, reset }: SalesErrorProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">
        <p className="font-semibold text-red-200">Erro ao carregar as vendas</p>
        <p className="mt-2 text-red-100/80">{error.message || "Tente novamente em instantes."}</p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center justify-center rounded-full border border-primary/60 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        Tentar novamente
      </button>
    </div>
  );
}
