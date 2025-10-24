import { kiwifyGET } from "@/lib/kiwify";

type BalanceResp = { available?: number; pending?: number; legal_entity_id?: string; [k: string]: any };
type PayoutsResp = { pagination?: any; data?: any[]; items?: any[]; results?: any[]; [k: string]: any };
type StatsResp = Record<string, any>;

const toISODate = (d: Date) => d.toISOString().slice(0, 10);
function lastNDaysRange(n: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (n - 1));
  return { start_date: toISODate(start), end_date: toISODate(end) };
}

export async function getBalance(): Promise<BalanceResp> {
  // Saldo disponível/pending
  return kiwifyGET("/v1/balance", {}) as Promise<BalanceResp>;
}

export async function listPayouts(params?: {
  page_size?: string;
  page_number?: string;
  legal_entity_id?: string;
}): Promise<PayoutsResp> {
  const qs: Record<string, string> = {};
  if (params?.page_size) qs.page_size = params.page_size;
  if (params?.page_number) qs.page_number = params.page_number;
  if (params?.legal_entity_id) qs.legal_entity_id = params.legal_entity_id;
  return kiwifyGET("/v1/payouts", qs) as Promise<PayoutsResp>;
}

export async function getSalesStats(params?: { start_date?: string; end_date?: string }): Promise<StatsResp> {
  let { start_date, end_date } = params ?? {};
  if (!start_date || !end_date) {
    const rng = lastNDaysRange(30); // padrão: últimos 30 dias
    start_date = rng.start_date;
    end_date = rng.end_date;
  }
  return kiwifyGET("/v1/stats", { start_date, end_date }) as Promise<StatsResp>;
}

export async function getFinancialSummary(opts?: { start_date?: string; end_date?: string }) {
  const balance = await getBalance();

  const [payouts, stats] = await Promise.all([
    listPayouts({ page_size: "10", page_number: "1", legal_entity_id: balance?.legal_entity_id }),
    getSalesStats({ start_date: opts?.start_date, end_date: opts?.end_date }),
  ]);

  console.log("[FIN] balance", {
    available: balance?.available,
    pending: balance?.pending,
    legal_entity_id: balance?.legal_entity_id,
  });
  console.log("[FIN] payouts.count", (payouts?.data ?? payouts?.items ?? payouts?.results ?? []).length);

  return { balance, payouts, stats };
}
