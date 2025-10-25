import { notFound } from "next/navigation";

import { formatCurrency, formatDateTime } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import { z } from "zod";

const customerSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  created_at: z.string(),
});

const orderSchema = z.object({
  external_id: z.string(),
  status: z.string().nullable(),
  gross_cents: z.number().nullable(),
  net_cents: z.number().nullable(),
  commission_cents: z.number().nullable(),
  approved_at: z.string().nullable(),
  created_at: z.string(),
});

interface EnrollmentResponse {
  items: {
    id: number;
    status: string;
    startedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    product: { title: string } | null;
  }[];
}

type Customer = z.infer<typeof customerSchema>;

async function getCustomer(id: number): Promise<Customer | null> {
  const { data, error } = await supabaseAdmin
    .from("kfy_customers")
    .select("id, name, email, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return customerSchema.parse(data);
}

async function getEnrollments(customerId: number) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const url = baseUrl ? `${baseUrl}/api/kfy/alunas?customerId=${customerId}` : `/api/kfy/alunas?customerId=${customerId}`;
  const response = await apiFetch(url, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Falha ao carregar matrículas");
  }
  return (await response.json()) as EnrollmentResponse;
}

async function getOrders(customerId: number): Promise<z.infer<typeof orderSchema>[]> {
  const { data, error } = await supabaseAdmin
    .from("kfy_orders")
    .select("external_id, status, gross_cents, net_cents, commission_cents, approved_at, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return z.array(orderSchema).parse(data ?? []);
}

export default async function AlunaDetalhePage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number.parseInt(params.id, 10);
  if (!Number.isFinite(id)) {
    notFound();
  }

  const customer = await getCustomer(id);
  if (!customer) {
    notFound();
  }

  const [enrollments, orders] = await Promise.all([getEnrollments(id), getOrders(id)]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white">{customer.name}</h1>
        <span className="text-sm text-muted-foreground">{customer.email}</span>
        <span className="text-xs text-muted-foreground">Cliente desde {formatDateTime(customer.created_at)}</span>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-white">Matrículas</h2>
        <div className="space-y-3">
          {enrollments.items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-surface-accent/40 bg-surface/80 p-4">
              <h3 className="text-base font-semibold text-white">{item.product?.title ?? "Produto"}</h3>
              <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <span>Status: <span className="capitalize text-white">{item.status}</span></span>
                <span>Início: {item.startedAt ? formatDateTime(item.startedAt) : "não disponível"}</span>
                <span>Expira: {item.expiresAt ? formatDateTime(item.expiresAt) : "não disponível"}</span>
              </div>
            </article>
          ))}
          {enrollments.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma matrícula encontrada para este cliente.</p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-white">Últimas compras</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-accent/40 text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">Pedido</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">Bruto</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">Líquido</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">Comissão</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-accent/20">
              {orders.map((order) => (
                <tr key={order.external_id} className="hover:bg-surface-accent/40">
                  <td className="px-4 py-2">{order.external_id}</td>
                  <td className="px-4 py-2 capitalize">{order.status}</td>
                  <td className="px-4 py-2">{formatCurrency(order.gross_cents ?? 0)}</td>
                  <td className="px-4 py-2">{formatCurrency(order.net_cents ?? 0)}</td>
                  <td className="px-4 py-2">{formatCurrency(order.commission_cents ?? 0)}</td>
                  <td className="px-4 py-2">{formatDateTime(order.approved_at ?? order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
