import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import SaleDetailsTabs, { type DetailItem, type DetailListItem } from "@/components/sale-details-tabs";
import { formatDate } from "@/lib/format";
import { formatCentsBRL } from "@/lib/format/currency";
import { formatPercentAuto } from "@/lib/format/percent";
import { formatSaleStatus, normalizeSaleMetadataValue, resolveSaleDocumentLabel } from "@/lib/sale-event-metadata";

export const dynamic = "force-dynamic";

type SaleDetail = Record<string, unknown>;

const SALES_BASE_PATH = "/api/sales" as const;

const candidateCollections = ["items", "order.items", "data.items", "data.order.items", "products", "order.products", "line_items"] as const;

const getNestedValue = (payload: Record<string, unknown>, path: string): unknown => {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) {
      return undefined;
    }

    if (Array.isArray(acc)) {
      const index = Number(key);
      if (Number.isInteger(index)) {
        return acc[index];
      }
      return undefined;
    }

    if (typeof acc === "object" && acc && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }

    return undefined;
  }, payload);
};

const pickString = (payload: Record<string, unknown>, paths: string[]): string | null => {
  for (const path of paths) {
    const value = getNestedValue(payload, path);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const pickNumber = (payload: Record<string, unknown>, paths: string[]): number | null => {
  for (const path of paths) {
    const value = getNestedValue(payload, path);

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
      if (!normalized) continue;
      const parsed = Number(normalized);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

const pickCollections = (payload: Record<string, unknown>, paths: readonly string[]) => {
  const result: Record<string, unknown>[] = [];
  for (const path of paths) {
    const value = getNestedValue(payload, path);
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === "object") {
          result.push(entry as Record<string, unknown>);
        }
      }
    }
  }
  return result;
};

const SALE_ID_PATHS = ["sale_id", "id", "sale.id", "data.sale_id", "data.id", "reference", "order.id", "order.reference"];
const PRODUCT_ID_PATHS = [
  "product_id",
  "product.id",
  "items.0.product.id",
  "order.product_id",
  "order.product.id",
  "data.product.id",
  "data.items.0.product.id",
  "product.product_id",
];
const PRODUCT_NAME_PATHS = [
  "product_name",
  "product.name",
  "product.title",
  "items.0.product.name",
  "items.0.name",
  "order.product.name",
  "data.product.name",
  "data.items.0.product.name",
  "offer_name",
];
const STATUS_PATHS = ["status", "data.status", "payment.status", "order.status", "sale.status"];
const CREATED_AT_PATHS = ["created_at", "paid_at", "sale_date", "order.created_at", "data.created_at", "data.sale_date"];
const UPDATED_AT_PATHS = ["updated_at", "data.updated_at", "order.updated_at", "payment.updated_at"];
const PAYMENT_METHOD_PATHS = [
  "payment_method",
  "payment.method",
  "payment.method_name",
  "payment.methodName",
  "order.payment.method",
  "data.payment.method",
];
const PAYMENT_GATEWAY_PATHS = ["payment.gateway", "payment.provider", "gateway", "payment.acquirer"];
const INSTALLMENTS_PATHS = [
  "payment.installments",
  "installments",
  "payment.number_installments",
  "installments_count",
  "order.installments",
];
const RECURRENCE_PATHS = [
  "subscription.interval",
  "subscription.frequency",
  "subscription.plan.interval",
  "subscription.type",
  "recurrence",
  "billing_cycle",
  "billing_interval",
];
const COUPON_PATHS = [
  "coupon.code",
  "coupon",
  "discount.coupon",
  "order.coupon.code",
  "data.coupon",
  "promotion.coupon",
];

const NET_AMOUNT_PATHS = [
  "net_amount",
  "amount_net",
  "total_net_amount",
  "payment.net_amount",
  "pricing.net_amount",
  "data.net_amount",
];
const GROSS_AMOUNT_PATHS = [
  "gross_amount",
  "amount",
  "total_amount",
  "payment.amount",
  "pricing.amount",
  "order.amount",
  "data.amount",
];
const FEES_AMOUNT_PATHS = ["fees", "fee_amount", "fees_amount", "total_fee", "total_fees", "payment.fees"];
const FEES_PERCENT_PATHS = ["fees_percentage", "fee_percentage", "payment.fees_percentage", "fees.percent"];
const KIWIFY_COMMISSION_PATHS = ["kiwify_commission_amount", "platform_commission", "kiwify_amount", "payment.kiwify_amount"];
const AFFILIATE_COMMISSION_PATHS = [
  "affiliate_commission_amount",
  "affiliate.amount",
  "commissions.affiliate",
  "affiliates.total_amount",
  "partner_commission",
];

const CUSTOMER_NAME_PATHS = [
  "customer.name",
  "customer.full_name",
  "buyer.name",
  "data.customer.name",
  "data.order.customer.name",
];
const CUSTOMER_EMAIL_PATHS = [
  "customer.email",
  "buyer.email",
  "data.customer.email",
  "data.order.customer.email",
];
const CUSTOMER_PHONE_PATHS = [
  "customer.phone",
  "customer.phone_number",
  "customer.mobile",
  "buyer.phone",
  "buyer.phone_number",
  "data.customer.phone",
  "data.order.customer.phone",
];
const CUSTOMER_DOCUMENT_PATHS = [
  "customer.document",
  "customer.cpf",
  "customer.cnpj",
  "buyer.document",
  "data.customer.document",
  "data.order.customer.document",
];
const ADDRESS_STREET_PATHS = [
  "customer.address.street",
  "customer.address.address1",
  "customer.address.line1",
  "address.street",
  "address.address1",
  "shipping_address.street",
];
const ADDRESS_NUMBER_PATHS = ["customer.address.number", "address.number", "customer.address.street_number"];
const ADDRESS_COMPLEMENT_PATHS = ["customer.address.complement", "address.complement", "customer.address.line2"];
const ADDRESS_NEIGHBORHOOD_PATHS = ["customer.address.neighborhood", "address.neighborhood", "customer.address.district"];
const ADDRESS_CITY_PATHS = ["customer.address.city", "address.city", "shipping_address.city"];
const ADDRESS_STATE_PATHS = ["customer.address.state", "address.state", "shipping_address.state", "address.province"];
const ADDRESS_ZIP_PATHS = [
  "customer.address.zip",
  "customer.address.postal_code",
  "address.zip",
  "address.zipcode",
  "address.postal_code",
  "shipping_address.zipcode",
];
const ADDRESS_COUNTRY_PATHS = ["customer.address.country", "address.country"];

const SPLIT_PATHS = ["split", "splits", "commissions", "partners", "distribution", "payouts"];
const REFUNDS_PATHS = ["refunds", "chargebacks", "refund_history", "refundEvents"];

const ITEM_NAME_PATHS = ["name", "product.name", "title", "product_title"];
const ITEM_QUANTITY_PATHS = ["quantity", "qty", "amount", "count"];
const ITEM_AMOUNT_PATHS = ["amount", "total", "price", "unit_price", "value"];

const buildBaseUrl = () => {
  const headersList = headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
};

const formatInstallments = (value: number | null): string | null => {
  if (value === null) return null;
  if (value <= 1) return "1 (à vista)";
  return `${Math.round(value)}x`;
};

const formatDateDisplay = (value: string | null): string | null => {
  if (!value) return null;
  return formatDate(value) ?? value;
};

const buildItemsList = (sale: SaleDetail): DetailListItem[] => {
  const collections = pickCollections(sale, candidateCollections);
  if (collections.length === 0) {
    return [];
  }

  return collections.map((item, index) => {
    const name = pickString(item, ITEM_NAME_PATHS) ?? `Item ${index + 1}`;
    const quantity = pickNumber(item, ITEM_QUANTITY_PATHS);
    const amount = pickNumber(item, ITEM_AMOUNT_PATHS);
    const parts: string[] = [];
    if (quantity !== null && quantity > 0) {
      parts.push(`${quantity}x`);
    }
    if (amount !== null) {
      parts.push(formatCentsBRL(amount));
    }
    const value = parts.length > 0 ? parts.join(" • ") : "—";
    return { label: name, value };
  });
};

const buildSplitList = (sale: SaleDetail): DetailListItem[] => {
  const collections = pickCollections(sale, SPLIT_PATHS);
  return collections.map((entry, index) => {
    const participant =
      pickString(entry, ["name", "title", "recipient.name", "partner_name"]) ??
      pickString(entry, ["role", "type", "split_type"]) ??
      `Participante ${index + 1}`;
    const amount = pickNumber(entry, ["amount", "value", "total", "net_amount"]);
    const percent = pickNumber(entry, ["percentage", "percent", "share"]);
    const pieces = [] as string[];
    if (amount !== null) {
      pieces.push(formatCentsBRL(amount));
    }
    if (percent !== null) {
      pieces.push(formatPercentAuto(percent));
    }
    const value = pieces.length > 0 ? pieces.join(" • ") : "—";
    return { label: participant, value };
  });
};

const buildRefundList = (sale: SaleDetail): DetailListItem[] => {
  const collections = pickCollections(sale, REFUNDS_PATHS);
  return collections.map((entry, index) => {
    const kind = pickString(entry, ["status", "type", "reason"]) ?? `Registro ${index + 1}`;
    const amount = pickNumber(entry, ["amount", "value", "total"]);
    const occurredAt = pickString(entry, ["created_at", "occurred_at", "date", "processed_at"]);
    const parts: string[] = [];
    if (amount !== null) {
      parts.push(formatCentsBRL(amount));
    }
    if (occurredAt) {
      const formatted = formatDateDisplay(occurredAt);
      if (formatted) {
        parts.push(formatted);
      }
    }
    const value = parts.length > 0 ? parts.join(" • ") : "—";
    return { label: kind, value };
  });
};

const buildAddress = (sale: SaleDetail): string | null => {
  const street = pickString(sale, ADDRESS_STREET_PATHS);
  const number = pickString(sale, ADDRESS_NUMBER_PATHS);
  const complement = pickString(sale, ADDRESS_COMPLEMENT_PATHS);
  const neighborhood = pickString(sale, ADDRESS_NEIGHBORHOOD_PATHS);
  const city = pickString(sale, ADDRESS_CITY_PATHS);
  const state = pickString(sale, ADDRESS_STATE_PATHS);
  const zip = pickString(sale, ADDRESS_ZIP_PATHS);
  const country = pickString(sale, ADDRESS_COUNTRY_PATHS);

  const parts: string[] = [];
  if (street) {
    parts.push(number ? `${street}, ${number}` : street);
  }
  if (complement) {
    parts.push(complement);
  }
  if (neighborhood) {
    parts.push(neighborhood);
  }
  const cityState = [city, state].filter(Boolean).join(" - ");
  if (cityState) {
    parts.push(cityState);
  }
  if (zip) {
    parts.push(`CEP ${zip}`);
  }
  if (country) {
    parts.push(country);
  }

  if (parts.length === 0) {
    return null;
  }
  return parts.join(" • ");
};

const fetchSaleDetail = async (saleId: string): Promise<SaleDetail | null> => {
  const baseUrl = buildBaseUrl();
  const url = new URL(`/api/sales/${encodeURIComponent(saleId)}`, baseUrl);
  const response = await fetch(url.toString(), { cache: "no-store" });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Erro ao carregar a venda");
  }

  const payload = (await response.json()) as { data?: unknown };
  if (!payload?.data || typeof payload.data !== "object") {
    throw new Error("Resposta da API não contém detalhes da venda");
  }

  return payload.data as SaleDetail;
};

const buildSaleItems = (sale: SaleDetail, computedSaleId: string): DetailItem[] => {
  const productName = pickString(sale, PRODUCT_NAME_PATHS);
  const productId = pickString(sale, PRODUCT_ID_PATHS);
  const statusRaw = pickString(sale, STATUS_PATHS);
  const statusDisplay = formatSaleStatus(statusRaw);
  const createdAt = pickString(sale, CREATED_AT_PATHS);
  const updatedAt = pickString(sale, UPDATED_AT_PATHS);
  const paymentMethod = pickString(sale, PAYMENT_METHOD_PATHS);
  const paymentGateway = pickString(sale, PAYMENT_GATEWAY_PATHS);
  const installments = pickNumber(sale, INSTALLMENTS_PATHS);
  const recurrence = pickString(sale, RECURRENCE_PATHS);
  const coupon = pickString(sale, COUPON_PATHS);
  const grossAmount = pickNumber(sale, GROSS_AMOUNT_PATHS);

  const itemList = buildItemsList(sale);

  const items: DetailItem[] = [
    { label: "ID da venda", value: computedSaleId },
    { label: "Status", value: statusDisplay ?? statusRaw },
    { label: "Produto", value: productId ? `${productName ?? "Produto"} (ID: ${productId})` : productName },
    { label: "Data da venda", value: formatDateDisplay(createdAt) },
    { label: "Última atualização", value: formatDateDisplay(updatedAt) },
  ];

  if (itemList.length > 0) {
    items.push({ label: "Itens", value: null, list: itemList });
  }

  if (coupon) {
    items.push({ label: "Cupom", value: coupon });
  }

  if (paymentMethod) {
    items.push({ label: "Método de pagamento", value: paymentMethod.toUpperCase() });
  }

  if (paymentGateway) {
    items.push({ label: "Gateway", value: paymentGateway });
  }

  if (recurrence) {
    items.push({ label: "Recorrência", value: recurrence });
  }

  if (installments !== null) {
    items.push({ label: "Parcelas", value: formatInstallments(installments) });
  }

  if (grossAmount !== null) {
    items.push({ label: "Valor total", value: formatCentsBRL(grossAmount) });
  }

  return items;
};

const buildCustomerItems = (sale: SaleDetail): DetailItem[] => {
  const name = pickString(sale, CUSTOMER_NAME_PATHS);
  const email = pickString(sale, CUSTOMER_EMAIL_PATHS);
  const phone = normalizeSaleMetadataValue(pickString(sale, CUSTOMER_PHONE_PATHS));
  const document = pickString(sale, CUSTOMER_DOCUMENT_PATHS);
  const documentLabel = resolveSaleDocumentLabel(document);
  const address = buildAddress(sale);

  const items: DetailItem[] = [
    { label: "Nome", value: name },
  ];

  if (email) {
    items.push({
      label: "Email",
      value: <a href={`mailto:${email}`} className="text-primary hover:underline">{email}</a>,
    });
  }

  if (phone) {
    const sanitized = phone.replace(/[^0-9+]/g, "");
    const telHref = sanitized ? `tel:${sanitized}` : null;
    items.push({
      label: "Telefone",
      value: telHref ? (
        <a href={telHref} className="text-primary hover:underline">{phone}</a>
      ) : (
        phone
      ),
    });
  }

  if (document) {
    items.push({ label: documentLabel, value: document });
  }

  if (address) {
    items.push({ label: "Endereço", value: address });
  }

  return items;
};

const buildFinancialItems = (sale: SaleDetail): DetailItem[] => {
  const netAmount = pickNumber(sale, NET_AMOUNT_PATHS);
  const grossAmount = pickNumber(sale, GROSS_AMOUNT_PATHS);
  const feesAmount = pickNumber(sale, FEES_AMOUNT_PATHS);
  const feesPercent = pickNumber(sale, FEES_PERCENT_PATHS);
  const kiwifyCommission = pickNumber(sale, KIWIFY_COMMISSION_PATHS);
  const affiliateCommission = pickNumber(sale, AFFILIATE_COMMISSION_PATHS);

  const splitList = buildSplitList(sale);
  const refundsList = buildRefundList(sale);

  const items: DetailItem[] = [
    { label: "Valor líquido", value: formatCentsBRL(netAmount) },
    { label: "Valor cheio", value: formatCentsBRL(grossAmount) },
  ];

  if (feesAmount !== null) {
    items.push({ label: "Taxas", value: formatCentsBRL(feesAmount) });
  }

  if (feesPercent !== null) {
    items.push({ label: "Taxa (%)", value: formatPercentAuto(feesPercent) });
  }

  if (kiwifyCommission !== null) {
    items.push({ label: "Comissão Kiwify", value: formatCentsBRL(kiwifyCommission) });
  }

  if (affiliateCommission !== null) {
    items.push({ label: "Comissão de afiliados", value: formatCentsBRL(affiliateCommission) });
  }

  if (splitList.length > 0) {
    items.push({ label: "Divisão dos valores", value: null, list: splitList });
  }

  if (refundsList.length > 0) {
    items.push({ label: "Reembolsos/chargebacks", value: null, list: refundsList });
  }

  return items;
};

const buildBackHref = (searchParams?: Record<string, string | string[] | undefined>) => {
  const allowed = ["status", "q", "start_date", "end_date", "page"];
  const params = new URLSearchParams();

  if (searchParams) {
    for (const key of allowed) {
      const value = searchParams[key];
      const resolved = Array.isArray(value) ? value[0] : value;
      if (resolved) {
        params.set(key, resolved);
      }
    }
  }

  const qs = params.toString();
  return qs ? `${SALES_BASE_PATH}?${qs}` : SALES_BASE_PATH;
};

interface SaleDetailsPageProps {
  params: { saleId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function SaleDetailsPage({ params, searchParams }: SaleDetailsPageProps) {
  const saleIdParam = decodeURIComponent(params.saleId);
  const sale = await fetchSaleDetail(saleIdParam);

  if (!sale) {
    notFound();
  }

  const saleId = pickString(sale, SALE_ID_PATHS) ?? saleIdParam;
  const productName = pickString(sale, PRODUCT_NAME_PATHS) ?? "Venda";
  const statusRaw = pickString(sale, STATUS_PATHS);
  const statusDisplay = formatSaleStatus(statusRaw);

  const saleItems = buildSaleItems(sale, saleId);
  const customerItems = buildCustomerItems(sale);
  const financialItems = buildFinancialItems(sale);

  const sections = [
    { id: "sale", label: "Venda", items: saleItems },
    { id: "customer", label: "Cliente", items: customerItems },
    { id: "financial", label: "Financeiro", items: financialItems },
  ];

  const backHref = buildBackHref(searchParams);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Detalhes da venda</p>
          <h1 className="text-3xl font-semibold text-primary-foreground">{productName}</h1>
          {statusDisplay ? (
            <p className="text-sm text-muted-foreground">{statusDisplay}</p>
          ) : null}
        </div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-full border border-surface-accent/60 bg-surface-accent px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
        >
          ← Voltar
        </Link>
      </header>

      <SaleDetailsTabs sections={sections} />

      <section className="rounded-3xl border border-surface-accent/30 bg-surface-accent/40 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Payload bruto</h3>
        <pre className="mt-4 max-h-[480px] overflow-auto rounded-2xl bg-black/40 p-4 text-xs leading-relaxed text-muted-foreground">
          {JSON.stringify(sale, null, 2)}
        </pre>
      </section>
    </div>
  );
}
