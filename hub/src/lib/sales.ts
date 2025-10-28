import { getServiceClient } from "@/lib/supabase/service";
import type { SalesRow } from "@/types/database";

export interface SalesPage {
  readonly items: readonly SalesRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

const DEFAULT_PAGE_SIZE = 10;

export async function listSales(page: number, pageSize = DEFAULT_PAGE_SIZE): Promise<SalesPage> {
  const currentPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : DEFAULT_PAGE_SIZE;
  const from = (currentPage - 1) * size;
  const to = from + size - 1;

  const client = getServiceClient();
  const { data, error, count } = await client
    .from("sales")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error) {
    throw new Error(`Falha ao carregar vendas: ${error.message}`);
  }

  const totalItems = count ?? data?.length ?? 0;
  const totalPages = totalItems === 0 ? 1 : Math.max(Math.ceil(totalItems / size), 1);

  return {
    items: (data ?? []) as SalesRow[],
    page: currentPage,
    pageSize: size,
    totalItems,
    totalPages
  };
}

export interface SalesStats {
  readonly totalSales: number;
  readonly grossAmountCents: number;
  readonly netAmountCents: number;
  readonly feeAmountCents: number;
  readonly lastSaleAt: string | null;
}

export async function fetchSalesStats(): Promise<SalesStats> {
  const client = getServiceClient();
  const { data, error } = await client.rpc("sales_stats");
  if (error) {
    throw new Error(`Falha ao carregar estatísticas: ${error.message}`);
  }
  const stats = data?.[0];
  return {
    totalSales: stats?.total_sales ?? 0,
    grossAmountCents: stats?.gross_amount_cents ?? 0,
    netAmountCents: stats?.net_amount_cents ?? 0,
    feeAmountCents: stats?.fee_amount_cents ?? 0,
    lastSaleAt: stats?.last_sale_at ?? null
  };
}
