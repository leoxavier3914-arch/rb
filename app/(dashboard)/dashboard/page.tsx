import { addDays, formatISO } from "date-fns";
import { headers } from "next/headers";

import { PaymentMethodPieChart } from "@/components/charts/PaymentMethodPieChart";
import { ProductBarChart } from "@/components/charts/ProductBarChart";
import { RevenueLineChart } from "@/components/charts/RevenueLineChart";
import { KpiCard } from "@/components/cards/KpiCard";
import { DateRangeFilter } from "@/components/filters/DateRange";

interface DashboardResponse {
  kpi: { grossCents: number; netCents: number; feeCents: number; commissionCents: number };
  statusCounts: { approved: number; pending: number; refunded: number; rejected: number };
  revenueSeries: { date: string; grossCents: number; netCents: number }[];
  productSeries: { product: string; grossCents: number }[];
  methodSeries: { method: string; grossCents: number }[];
}

function resolveBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (envUrl) {
    const normalized = envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
    return normalized.replace(/\/$/, "");
  }

  const headersList = headers();
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");

  if (!host) {
    throw new Error("Unable to determine base URL");
  }

  return `${protocol}://${host}`.replace(/\/$/, "");
}

async function getDashboardData(searchParams: Record<string, string | string[] | undefined>): Promise<DashboardResponse> {
  const from = typeof searchParams.from === "string" ? searchParams.from : formatISO(addDays(new Date(), -6), { representation: "date" });
  const to = typeof searchParams.to === "string" ? searchParams.to : formatISO(new Date(), { representation: "date" });
  const params = new URLSearchParams({ from, to });
  if (typeof searchParams.status === "string") params.set("status", searchParams.status);
  if (typeof searchParams.productId === "string") params.set("productId", searchParams.productId);
  if (typeof searchParams.paymentMethod === "string") params.set("paymentMethod", searchParams.paymentMethod);

  const baseUrl = resolveBaseUrl();
  const url = new URL("/api/kfy/dashboard", baseUrl);
  url.search = params.toString();

  const response = await fetch(url.toString(), {
    headers: { "x-admin-role": "true" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Falha ao carregar painel");
  }

  return response.json();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await getDashboardData(searchParams);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-white">Filtros</h2>
        <DateRangeFilter />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Valor Faturado" value={data.kpi.grossCents} />
        <KpiCard title="Valor Líquido" value={data.kpi.netCents} />
        <KpiCard title="Comissão Kiwify" value={data.kpi.commissionCents} />
        <div className="flex flex-col gap-3 rounded-2xl border border-surface-accent/40 bg-surface px-6 py-5 shadow-soft">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</span>
          <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
            <span>Aprovadas</span>
            <span className="text-right text-white">{data.statusCounts.approved}</span>
            <span>Pendentes</span>
            <span className="text-right text-white">{data.statusCounts.pending}</span>
            <span>Reembolsadas</span>
            <span className="text-right text-white">{data.statusCounts.refunded}</span>
            <span>Recusadas</span>
            <span className="text-right text-white">{data.statusCounts.rejected}</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-white">Receita diária</h3>
          <RevenueLineChart data={data.revenueSeries} />
        </div>
        <div>
          <h3 className="mb-4 text-lg font-semibold text-white">Método de pagamento</h3>
          <PaymentMethodPieChart data={data.methodSeries} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-white">Top produtos</h3>
        <ProductBarChart data={data.productSeries} />
      </section>
    </div>
  );
}
