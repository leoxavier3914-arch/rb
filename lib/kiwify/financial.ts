import { kiwifyGET } from "@/lib/kiwify";

export async function getBalance() {
  // Saldo disponível/pending
  return kiwifyGET("/v1/balance", {});
}

export async function listPayouts(params?: {
  page_size?: string;
  page_number?: string;
  legal_entity_id?: string;
}) {
  const qs: Record<string, string> = {};
  if (params?.page_size) qs.page_size = params.page_size;
  if (params?.page_number) qs.page_number = params.page_number;
  if (params?.legal_entity_id) qs.legal_entity_id = params.legal_entity_id;
  return kiwifyGET("/v1/payouts", qs);
}

export async function getSalesStats() {
  // estatísticas de vendas; ajuste se for preciso filtrar por período
  return kiwifyGET("/v1/stats", {});
}

export async function getFinancialSummary() {
  // Agrega os 3 para a UI
  const [balance, payouts, stats] = await Promise.all([
    getBalance(), // { available, pending, legal_entity_id }
    listPayouts({ page_size: "10", page_number: "1" }), // { pagination, data: [...] }
    getSalesStats(), // estrutura conforme doc /v1/stats
  ]);

  return { balance, payouts, stats };
}
