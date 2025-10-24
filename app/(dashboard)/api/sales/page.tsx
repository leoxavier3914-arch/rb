import { JsonPreview } from "@/components/json-preview";
import { hasKiwifyApiEnv } from "@/lib/env";
import { kiwifyGET } from "@/lib/kiwify";
import { formatKiwifyApiPath, KiwifyApiError } from "@/lib/kiwify/client";

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Busca todas as vendas da Kiwify, em janelas de 90 dias e paginando até o final.
 */
async function getAllSales(): Promise<any[]> {
  const results: any[] = [];
  const today = new Date();
  let start = new Date("2020-01-01");
  const MAX_WINDOW = 90;

  while (start <= today) {
    const end = new Date(start);
    end.setDate(start.getDate() + (MAX_WINDOW - 1));
    if (end > today) end.setTime(today.getTime());

    let page_number = 1;
    const page_size = 100;

    while (true) {
      const qs = {
        start_date: toISODate(start),
        end_date: toISODate(end),
        page_size: String(page_size),
        page_number: String(page_number),
      };

      console.log(
        "[Kiwify][Sales] Janela:",
        qs.start_date,
        "→",
        qs.end_date,
        "Página:",
        page_number,
      );

      const resp = await kiwifyGET("/v1/sales", qs);
      const data = Array.isArray(resp)
        ? resp
        : resp.data ?? resp.items ?? resp.results ?? [];
      const batch = data ?? [];
      results.push(...batch);

      const meta = resp.pagination ?? resp.meta ?? {};
      const total_pages = Number(meta.total_pages ?? meta.totalPages ?? NaN);
      const current_page = Number(meta.page_number ?? meta.page ?? page_number);

      if (!Number.isNaN(total_pages) && total_pages > 0) {
        if (current_page >= total_pages) break;
      } else {
        if (batch.length < page_size) break;
      }

      page_number++;
    }

    const next = new Date(end);
    next.setDate(next.getDate() + 1);
    start = next;
  }

  return results;
}

function groupSalesByStatus(sales: any[]) {
  const groups = {
    paid: [] as any[],
    refunded: [] as any[],
    refused: [] as any[],
    pending: [] as any[],
    other: [] as any[],
  };

  for (const sale of sales) {
    const status = String(sale?.status ?? "").toLowerCase();

    if (status.includes("paid")) {
      groups.paid.push(sale);
    } else if (status.includes("refund")) {
      groups.refunded.push(sale);
    } else if (status.includes("refus")) {
      groups.refused.push(sale);
    } else if (status.includes("pend")) {
      groups.pending.push(sale);
    } else {
      groups.other.push(sale);
    }
  }

  return groups;
}

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  if (!hasKiwifyApiEnv()) {
    return (
      <div className="rounded-2xl border border-dashed border-yellow-500/40 bg-yellow-500/10 p-6 text-sm text-yellow-100">
        Configure as credenciais da API para acompanhar pedidos e vendas registrados na Kiwify.
      </div>
    );
  }

  let sales: unknown = null;
  let error: string | null = null;

  try {
    const items = await getAllSales();
    const grouped = groupSalesByStatus(items);
    sales = {
      total: items.length,
      totalPaid: grouped.paid.length,
      totalRefused: grouped.refused.length,
      totalRefunded: grouped.refunded.length,
      totalPending: grouped.pending.length,
      ...grouped,
    };
  } catch (err) {
    console.error("Erro ao consultar vendas na Kiwify", err);

    const defaultMessage = "Não foi possível listar as vendas. Ajuste filtros ou valide o token.";
    let message = defaultMessage;

    if (err instanceof KiwifyApiError) {
      const details = (err.details ?? null) as { type?: string } | null;

      if (err.status === 400 && details?.type === "validation_error") {
        message = "Nenhuma venda encontrada no período informado";
      }
    }

    error = message;
  }

  const salesPath = formatKiwifyApiPath("sales");

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-white">Vendas consolidadas</h3>
        <p className="text-sm text-muted-foreground">
          Use a API para auditar pedidos além dos webhooks, consultar status de cobrança, formas de pagamento, split e
          comissão da Kiwify. A resposta segue os contratos descritos em {salesPath}.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">{error}</div>
      ) : (
        <JsonPreview title={`Lista de vendas (GET ${salesPath})`} data={sales} />
      )}
    </div>
  );
}
