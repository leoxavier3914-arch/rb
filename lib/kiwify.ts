import { createHash } from "node:crypto";
import { SAO_PAULO_TIME_ZONE } from "./timezone";

async function fetchToken() {
  const clientId = process.env.KIWIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.KIWIFY_CLIENT_SECRET?.trim();

  if (!clientId) {
    throw new Error("Missing KIWIFY_CLIENT_ID environment variable");
  }

  if (!clientSecret) {
    throw new Error("Missing KIWIFY_CLIENT_SECRET environment variable");
  }

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const r = await fetch("https://public-api.kiwify.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!r.ok) throw new Error(`Kiwify token: ${r.status} ${await r.text()}`);
  const d = await r.json();
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: d.access_token as string,
    expires_at: now + Number(d.expires_in ?? 3600),
  };
}

type KiwifyAuth = { access_token: string; expires_at: number };
let cache: KiwifyAuth | null = null;
let inflight: Promise<KiwifyAuth> | null = null;

export async function getKiwifyAuth(): Promise<KiwifyAuth> {
  const now = Math.floor(Date.now() / 1000);
  if (cache && cache.expires_at - now > 60) return cache;
  if (!inflight) inflight = fetchToken().finally(() => (inflight = null));
  cache = await inflight!;
  return cache!;
}

export async function kiwifyGET(
  path: string,
  qs?: Record<string, string | number | undefined>,
) {
  const { access_token } = await getKiwifyAuth();
  const url = new URL(`https://public-api.kiwify.com${path}`);
  if (qs)
    for (const [k, v] of Object.entries(qs))
      if (v != null) url.searchParams.set(k, String(v));

  const accountId = String(process.env.KIWIFY_ACCOUNT_ID ?? "").trim();
  if (!accountId) {
    throw new Error("Missing KIWIFY_ACCOUNT_ID environment variable");
  }

  const headers = {
    Authorization: `Bearer ${access_token}`,
    "x-kiwify-account-id": accountId,
  };

  console.log("[KIWIFY] GET", url.toString(), {
    accountId: headers["x-kiwify-account-id"],
    tokenPrefix: access_token.slice(0, 16),
  });

  let res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 401) {
    cache = null;
    const fresh = await getKiwifyAuth();
    const headers2 = {
      Authorization: `Bearer ${fresh.access_token}`,
      "x-kiwify-account-id": accountId,
    };
    res = await fetch(url, { headers: headers2, cache: "no-store" });
  }
  if (!res.ok) throw new Error(`Kiwify GET ${url.pathname}: ${res.status} ${await res.text()}`);
  return res.json();
}

interface NormalizedBase {
  eventReference: string;
  customerName: string | null;
  customerEmail: string | null;
  productName: string | null;
  amount: number | null;
  grossAmount: number | null;
  netAmount: number | null;
  kiwifyCommissionAmount: number | null;
  affiliateCommissionAmount: number | null;
  currency: string | null;
  occurredAt: string | null;
  payload: Record<string, unknown>;
}

export interface NormalizedSaleLike extends NormalizedBase {
  saleId: string | null;
  paymentMethod: string | null;
  status: string | null;
  role: string | null;
  customerPhone: string | null;
  customerDocument: string | null;
  customerIp: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

export type NormalizedApprovedSale = NormalizedSaleLike;
export type NormalizedPendingPayment = NormalizedSaleLike;
export type NormalizedRejectedPayment = NormalizedSaleLike;
export type NormalizedRefundedSale = NormalizedSaleLike;

export interface NormalizedAbandonedCart extends NormalizedBase {
  cartId: string | null;
  checkoutUrl: string | null;
  status: string | null;
}

export interface NormalizedSubscriptionEvent extends NormalizedSaleLike {
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  eventType: string | null;
}

type UnknownPayload = Record<string, unknown>;

const stringCoalesce = (payload: UnknownPayload, paths: string[]) => {
  for (const path of paths) {
    const value = get(payload, path);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const numberCoalesce = (payload: UnknownPayload, paths: string[]) => {
  for (const path of paths) {
    const raw = get(payload, path);
    if (raw === null || raw === undefined) continue;
    if (typeof raw !== "number" && typeof raw !== "string") {
      continue;
    }

    const parsed =
      typeof raw === "number"
        ? raw
        : Number(String(raw).replace(/[^0-9.,-]/g, "").replace(",", "."));
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
};

function get(payload: UnknownPayload, path: string) {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    if (Array.isArray(acc)) {
      const index = Number(key);
      if (!Number.isNaN(index)) {
        return acc[index];
      }
    }
    return undefined;
  }, payload);
}

const SAO_PAULO_OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: SAO_PAULO_TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const SAO_PAULO_OFFSET_DEFAULT = -3 * 60;

const TIMEZONE_REGEX = /(Z|[+-]\d{2}:?\d{2})$/i;

const parseNaiveDateTime = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2})(?::(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?)?$/,
  );

  if (!match) {
    return null;
  }

  const [, y, m, d, h = "00", min = "00", s = "00", ms = ""] = match;
  const millisecond = ms
    ? Math.min(999, Math.round((Number(ms) * 1000) / 10 ** ms.length))
    : 0;

  return {
    year: Number(y),
    month: Number(m),
    day: Number(d),
    hour: Number(h),
    minute: Number(min),
    second: Number(s),
    millisecond,
  };
};

const getSaoPauloOffsetMinutesForInstant = (instantMs: number) => {
  const parts = SAO_PAULO_OFFSET_FORMATTER.formatToParts(new Date(instantMs));
  const components: Record<string, number> = {};

  for (const part of parts) {
    if (part.type === "literal") continue;
    components[part.type] = Number(part.value);
  }

  if (
    components.year === undefined ||
    components.month === undefined ||
    components.day === undefined
  ) {
    return SAO_PAULO_OFFSET_DEFAULT;
  }

  const asUtc = Date.UTC(
    components.year,
    (components.month ?? 1) - 1,
    components.day ?? 1,
    components.hour ?? 0,
    components.minute ?? 0,
    components.second ?? 0,
  );

  return Math.round((asUtc - instantMs) / 60000);
};

const convertNaiveStringToSaoPauloIso = (value: string) => {
  const parsed = parseNaiveDateTime(value);
  if (!parsed) {
    return null;
  }

  const { year, month, day, hour, minute, second, millisecond } = parsed;

  const baselineUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

  let offset = getSaoPauloOffsetMinutesForInstant(baselineUtc);
  let adjustedUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond) -
    offset * 60_000;

  offset = getSaoPauloOffsetMinutesForInstant(adjustedUtc);
  adjustedUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond) -
    offset * 60_000;

  const candidate = new Date(adjustedUtc);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  return candidate.toISOString();
};

export const normalizeDate = (payload: UnknownPayload, paths: string[]) => {
  for (const path of paths) {
    const value = get(payload, path);
    if (!value) continue;
    if (typeof value === "number") {
      const candidate = new Date(value * 1000);
      if (!Number.isNaN(candidate.getTime())) {
        return candidate.toISOString();
      }
      continue;
    }

    if (typeof value === "string") {
      const strValue = value.trim();
      if (strValue.length === 0) continue;

      if (!TIMEZONE_REGEX.test(strValue)) {
        const converted = convertNaiveStringToSaoPauloIso(strValue.replace(" ", "T"));
        if (converted) {
          return converted;
        }
      }

      const candidate = new Date(strValue);
      if (!Number.isNaN(candidate.getTime())) {
        return candidate.toISOString();
      }
    }
  }
  return null;
};

const fingerprint = (payload: UnknownPayload, hint?: string | null) => {
  const base = hint ?? JSON.stringify(payload ?? {});
  return createHash("sha1").update(base).digest("hex");
};

const normalizeAmount = (value: number | null): number | null => {
  if (value === null) {
    return null;
  }

  if (Number.isInteger(value)) {
    return value / 100;
  }

  return value;
};

const asciiFold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizeKey = (value: string) =>
  asciiFold(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

type CommissionRole = "producer" | "kiwify" | "affiliate" | "gross" | string;

const normalizeCommissionRole = (value: string | null | undefined): CommissionRole | null => {
  if (!value) {
    return null;
  }

  const normalized = normalizeKey(value);
  if (!normalized) {
    return null;
  }

  const directMap: Record<string, CommissionRole> = {
    producer: "producer",
    produtores: "producer",
    produtor: "producer",
    produtor_principal: "producer",
    criador: "producer",
    creator: "producer",
    owner: "producer",
    seller: "producer",
    vendedor: "producer",
    liquid: "producer",
    liquido: "producer",
    valor_liquido: "producer",
    net: "producer",
    net_amount: "producer",
    minha_comissao: "producer",
    minha_receita: "producer",
    kiwify: "kiwify",
    taxa_kiwify: "kiwify",
    comissao_kiwify: "kiwify",
    plataforma: "kiwify",
    platform: "kiwify",
    gateway: "kiwify",
    taxa: "kiwify",
    fee: "kiwify",
    affiliate: "affiliate",
    afiliado: "affiliate",
    afiliada: "affiliate",
    coprodutor: "affiliate",
    coprodutora: "affiliate",
    co_produtor: "affiliate",
    coproducer: "affiliate",
    partner: "affiliate",
    gross: "gross",
    bruto: "gross",
    valor_bruto: "gross",
    valor_cheio: "gross",
    valor_total: "gross",
    total: "gross",
    total_bruto: "gross",
    charge: "gross",
    charge_amount: "gross",
    full_price: "gross",
    price_total: "gross",
  };

  if (directMap[normalized]) {
    return directMap[normalized];
  }

  if (/kiwify|plataforma|platform|gateway|taxa|tarifa|fee/.test(normalized)) {
    return "kiwify";
  }

  if (/afiliad|affiliate|coprodut|partner/.test(normalized)) {
    return "affiliate";
  }

  if (/produt|producer|creator|owner|seller|liquid|net|minha/.test(normalized)) {
    return "producer";
  }

  if (/gross|bruto|cheio|total|charge|price/.test(normalized)) {
    return "gross";
  }

  return normalized;
};

interface CommissionEntry {
  role: CommissionRole | null;
  amount: number | null;
}

const COMMISSION_CONTAINER_PATHS = [
  "Commissions",
  "commissions",
  "data.Commissions",
  "data.commissions",
  "data.order.Commissions",
  "data.order.commissions",
  "data.order.commission_split",
  "data.order.commission",
  "data.order.commission_details",
  "data.checkout.Commissions",
  "data.checkout.commissions",
  "data.checkout.commission",
  "data.checkout.commission_split",
  "data.transaction.commissions",
  "data.payment.commissions",
  "order.commissions",
  "Order.commissions",
  "charges.completed.0.commissions",
  "Subscription.charges.completed.0.commissions",
];

const COMMISSION_ROLE_HINT_KEYS = [
  "producer",
  "produtor",
  "produtora",
  "creator",
  "criador",
  "owner",
  "seller",
  "vendedor",
  "kiwify",
  "affiliate",
  "afiliado",
  "afiliada",
  "coprodutor",
  "coprodutora",
  "coproducer",
  "co_produtor",
];

const COMMISSION_NESTED_KEYS = [
  "entries",
  "items",
  "list",
  "values",
  "details",
  "components",
  "breakdown",
];

const COMMISSION_AMOUNT_PATHS = [
  "amount",
  "amount.value",
  "amount.value_cents",
  "amount.total",
  "amount.total_value",
  "value",
  "value.amount",
  "value_cents",
  "commission",
  "commission_value",
  "net_value",
  "net_amount",
  "total_value",
];

const collectCommissionEntriesFromValue = (
  value: unknown,
  inheritedRole: CommissionRole | null = null,
): CommissionEntry[] => {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectCommissionEntriesFromValue(entry));
  }

  if (typeof value !== "object") {
    return [];
  }

  const record = value as UnknownPayload;
  const entries: CommissionEntry[] = [];

  const roleCandidate = stringCoalesce(record, [
    "type",
    "role",
    "kind",
    "commission_type",
    "commissionType",
    "title",
    "name",
    "label",
  ]);

  const resolvedRole = normalizeCommissionRole(roleCandidate ?? inheritedRole ?? null);
  const amountCandidate = normalizeAmount(numberCoalesce(record, COMMISSION_AMOUNT_PATHS));

  if (resolvedRole || amountCandidate !== null) {
    entries.push({ role: resolvedRole, amount: amountCandidate });
  }

  for (const [key, nested] of Object.entries(record)) {
    const normalizedKey = normalizeKey(key);

    if (COMMISSION_ROLE_HINT_KEYS.some((candidate) => normalizeKey(candidate) === normalizedKey)) {
      const nestedRole = normalizeCommissionRole(key);
      entries.push(...collectCommissionEntriesFromValue(nested, nestedRole));
      continue;
    }

    const detectedRole = normalizeCommissionRole(key);
    if (detectedRole && detectedRole !== resolvedRole) {
      const directAmount = normalizeAmount(numberCoalesce(record, [key]));
      if (directAmount !== null) {
        entries.push({ role: detectedRole, amount: directAmount });
      }
    }

    if (COMMISSION_NESTED_KEYS.includes(normalizedKey) && nested !== record) {
      entries.push(...collectCommissionEntriesFromValue(nested, resolvedRole));
    }
  }

  return entries.filter((entry) => entry.role || entry.amount !== null);
};

const collectCommissionEntries = (payload: UnknownPayload): CommissionEntry[] => {
  const entries: CommissionEntry[] = [];

  for (const path of COMMISSION_CONTAINER_PATHS) {
    const value = get(payload, path);
    if (value !== null && value !== undefined) {
      entries.push(...collectCommissionEntriesFromValue(value));
    }
  }

  return entries;
};

const pickCommissionAmount = (
  entries: CommissionEntry[],
  role: CommissionRole,
): number | null => {
  for (const entry of entries) {
    if (entry.role && normalizeCommissionRole(entry.role) === role && entry.amount !== null) {
      return entry.amount;
    }
  }

  return null;
};

const firstNonNull = <T>(values: (T | null | undefined)[]): T | null => {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
};

const DEFAULT_AMOUNT_PATHS = [
  "Commissions.charge_amount",
  "commissions.charge_amount",
  "charge_amount",
  "amount",
  "data.amount",
  "data.amount.value",
  "data.amount.value_cents",
  "data.amount.total",
  "data.amount.total_value",
  "data.amount.amount",
  "data.order.amount",
  "data.order.amount.value",
  "data.order.amount.value_cents",
  "data.order.amount.total",
  "data.order.amount.total_value",
  "data.order.total",
  "data.order.total_value",
  "data.checkout.amount",
  "data.checkout.amount.value",
  "data.checkout.amount.value_cents",
  "data.checkout.amount.total",
  "data.checkout.amount.total_value",
  "transaction.amount",
  "data.transaction.amount",
  "order.amount",
  "Order.amount",
  "value",
  "price",
  "charges.completed.0.amount",
  "Subscription.charges.completed.0.amount",
  "SmartInstallment.amount_total",
];

const DEFAULT_NET_AMOUNT_PATHS = [
  "Commissions.producer_commission",
  "commissions.producer_commission",
  "Commissions.producer_amount",
  "commissions.producer_amount",
  "Commissions.producer",
  "commissions.producer",
  "Commissions.my_commission",
  "commissions.my_commission",
  "Commissions.net_amount",
  "commissions.net_amount",
  "data.commissions.producer_commission",
  "data.Commissions.producer_commission",
  "data.order.commissions.producer_commission",
  "data.order.Commissions.producer_commission",
  "data.checkout.commissions.producer_commission",
  "data.checkout.Commissions.producer_commission",
  "data.commissions.my_commission",
  "data.order.commissions.my_commission",
  "data.checkout.commissions.my_commission",
  "data.commissions.net_amount",
  "data.order.commissions.net_amount",
  "data.checkout.commissions.net_amount",
];

const DEFAULT_KIWIFY_COMMISSION_PATHS = [
  "Commissions.kiwify_commission",
  "commissions.kiwify_commission",
  "Commissions.kiwify_fee",
  "commissions.kiwify_fee",
  "Commissions.kiwify_amount",
  "commissions.kiwify_amount",
  "data.commissions.kiwify_commission",
  "data.order.commissions.kiwify_commission",
  "data.checkout.commissions.kiwify_commission",
  "data.commissions.kiwify_fee",
  "data.order.commissions.kiwify_fee",
  "data.checkout.commissions.kiwify_fee",
];

const DEFAULT_AFFILIATE_COMMISSION_PATHS = [
  "Commissions.affiliate_commission",
  "commissions.affiliate_commission",
  "Commissions.affiliate_amount",
  "commissions.affiliate_amount",
  "Commissions.affiliate_fee",
  "commissions.affiliate_fee",
  "data.commissions.affiliate_commission",
  "data.order.commissions.affiliate_commission",
  "data.checkout.commissions.affiliate_commission",
  "data.commissions.affiliate_fee",
  "data.order.commissions.affiliate_fee",
  "data.checkout.commissions.affiliate_fee",
  "data.commissions.coproducer_commission",
  "data.order.commissions.coproducer_commission",
  "data.checkout.commissions.coproducer_commission",
];

interface AmountBreakdown {
  amount: number | null;
  grossAmount: number | null;
  netAmount: number | null;
  kiwifyCommissionAmount: number | null;
  affiliateCommissionAmount: number | null;
}

const resolveAmountFields = (
  payload: UnknownPayload,
  overrides?: Partial<{
    amountPaths: string[];
    netPaths: string[];
    kiwifyPaths: string[];
    affiliatePaths: string[];
  }>,
): AmountBreakdown => {
  const entries = collectCommissionEntries(payload);

  const amountPaths = overrides?.amountPaths ?? DEFAULT_AMOUNT_PATHS;
  const netPaths = overrides?.netPaths ?? DEFAULT_NET_AMOUNT_PATHS;
  const kiwifyPaths = overrides?.kiwifyPaths ?? DEFAULT_KIWIFY_COMMISSION_PATHS;
  const affiliatePaths = overrides?.affiliatePaths ?? DEFAULT_AFFILIATE_COMMISSION_PATHS;

  const baseAmount = normalizeAmount(numberCoalesce(payload, amountPaths));
  const netDirect = normalizeAmount(numberCoalesce(payload, netPaths));
  const kiwifyDirect = normalizeAmount(numberCoalesce(payload, kiwifyPaths));
  const affiliateDirect = normalizeAmount(numberCoalesce(payload, affiliatePaths));

  const grossFromEntries = pickCommissionAmount(entries, "gross");
  const netFromEntries = pickCommissionAmount(entries, "producer");
  const kiwifyFromEntries = pickCommissionAmount(entries, "kiwify");
  const affiliateFromEntries = pickCommissionAmount(entries, "affiliate");

  const grossAmount = firstNonNull([grossFromEntries, baseAmount]);
  const kiwifyCommissionAmount = firstNonNull([kiwifyDirect, kiwifyFromEntries]);
  const affiliateCommissionAmount = firstNonNull([affiliateDirect, affiliateFromEntries]);

  let netAmount = firstNonNull([netDirect, netFromEntries]);

  if (netAmount === null && grossAmount !== null) {
    const deductions = [kiwifyCommissionAmount, affiliateCommissionAmount]
      .filter((value): value is number => value !== null)
      .reduce((total, value) => total + value, 0);

    if (deductions > 0 && deductions <= grossAmount) {
      netAmount = grossAmount - deductions;
    }
  }

  const amount = firstNonNull([netAmount, baseAmount, grossAmount]);

  return {
    amount,
    grossAmount: grossAmount ?? amount,
    netAmount: netAmount ?? amount,
    kiwifyCommissionAmount,
    affiliateCommissionAmount,
  };
};

const SALE_STATUS_PATHS = [
  "status",
  "Status",
  "order_status",
  "order.status",
  "order.order_status",
  "Order.status",
  "Order.order_status",
  "payment_status",
  "payment.status",
  "Payment.status",
  "sale.status",
  "transaction.status",
  "charges.completed.0.status",
  "Subscription.status",
  "subscription.status",
  "subscription_status",
  "data.status",
  "data.order.status",
  "data.order.order_status",
  "data.order.payment.status",
  "data.payment.status",
  "data.transaction.status",
];

const SALE_ROLE_PATHS = [
  "role",
  "Role",
  "data.role",
  "data.order.role",
  "metadata.role",
  "data.metadata.role",
  "data.order.metadata.role",
  "sale_type",
  "saleType",
  "data.sale_type",
  "data.saleType",
  "data.order.sale_type",
  "data.order.saleType",
  "Sale.sale_type",
  "Sale.saleType",
];

const CUSTOMER_PHONE_PATHS = [
  "customer.phone",
  "customer.phone_number",
  "customer.phoneNumber",
  "customer.mobile",
  "customer.mobile_phone",
  "customer.mobilePhone",
  "customer.mobile_number",
  "customer.mobilePhoneNumber",
  "customer_phone",
  "customer_phone_number",
  "customerPhone",
  "customerPhoneNumber",
  "Customer.mobile",
  "Customer.mobile_phone",
  "Customer.mobileNumber",
  "Customer.mobile_number",
  "Customer.mobilePhoneNumber",
  "Customer.phone",
  "Customer.phone_number",
  "Customer.phoneNumber",
  "customer.mobilePhoneNumber",
  "data.customer.phone",
  "data.customer.phone_number",
  "data.customer.phoneNumber",
  "data.customer.mobile",
  "data.customer.mobile_phone",
  "data.customer.mobileNumber",
  "data.customer.mobile_number",
  "data.customer.mobilePhoneNumber",
  "data.order.customer.phone",
  "data.order.customer.phone_number",
  "data.order.customer.phoneNumber",
  "data.order.customer.mobile",
  "data.order.customer.mobile_phone",
  "data.order.customer.mobileNumber",
  "data.order.customer.mobile_number",
  "data.order.customer.mobilePhoneNumber",
  "buyer.phone",
  "buyer.phoneNumber",
  "buyer.mobile",
  "buyer.mobileNumber",
  "buyer.mobile_phone",
  "buyer.mobile_number",
  "buyer.mobilePhoneNumber",
  "data.buyer.phone",
  "data.buyer.phone_number",
  "data.buyer.phoneNumber",
  "data.buyer.mobile",
  "data.buyer.mobile_phone",
  "data.buyer.mobileNumber",
  "data.buyer.mobile_number",
  "data.buyer.mobilePhoneNumber",
];

const CUSTOMER_DOCUMENT_PATHS = [
  "customer.document",
  "customer.cpf",
  "customer.CPF",
  "customer.cnpj",
  "customer.CNPJ",
  "customer.tax_id",
  "customer.taxId",
  "customer.document_number",
  "customer.documentNumber",
  "customer_document",
  "customer_document_number",
  "customerDocument",
  "customerDocumentNumber",
  "Customer.CPF",
  "Customer.CNPJ",
  "Customer.cpf",
  "Customer.cnpj",
  "Customer.document",
  "Customer.tax_id",
  "Customer.document_number",
  "Customer.documentNumber",
  "data.customer.document",
  "data.customer.cpf",
  "data.customer.CPF",
  "data.customer.cnpj",
  "data.customer.CNPJ",
  "data.customer.tax_id",
  "data.customer.taxId",
  "data.customer.document_number",
  "data.customer.documentNumber",
  "data.order.customer.document",
  "data.order.customer.cpf",
  "data.order.customer.CPF",
  "data.order.customer.cnpj",
  "data.order.customer.CNPJ",
  "data.order.customer.tax_id",
  "data.order.customer.taxId",
  "data.order.customer.document_number",
  "data.order.customer.documentNumber",
  "buyer.document",
  "buyer.cpf",
  "buyer.CPF",
  "buyer.cnpj",
  "buyer.CNPJ",
  "buyer.tax_id",
  "buyer.taxId",
  "buyer.document_number",
  "buyer.documentNumber",
  "data.buyer.document",
  "data.buyer.cpf",
  "data.buyer.CPF",
  "data.buyer.cnpj",
  "data.buyer.CNPJ",
  "data.buyer.tax_id",
  "data.buyer.taxId",
  "data.buyer.document_number",
  "data.buyer.documentNumber",
];

const CUSTOMER_IP_PATHS = [
  "customer.ip",
  "customer_ip",
  "Customer.ip",
  "client_ip",
  "data.client_ip",
  "data.customer.ip",
  "data.order.customer.ip",
  "request.ip",
  "data.request.ip",
];

const UTM_SOURCE_PATHS = [
  "utm_source",
  "utmSource",
  "data.utm_source",
  "data.utmSource",
  "data.metadata.utm_source",
  "data.metadata.utmSource",
  "data.order.utm_source",
  "data.order.utmSource",
  "data.order.metadata.utm_source",
  "data.order.metadata.utmSource",
  "metadata.utm_source",
  "metadata.utmSource",
  "TrackingParameters.utm_source",
  "TrackingParameters.utmSource",
  "trackingParameters.utm_source",
  "trackingParameters.utmSource",
];

const UTM_MEDIUM_PATHS = [
  "utm_medium",
  "utmMedium",
  "data.utm_medium",
  "data.utmMedium",
  "data.metadata.utm_medium",
  "data.metadata.utmMedium",
  "data.order.utm_medium",
  "data.order.utmMedium",
  "data.order.metadata.utm_medium",
  "data.order.metadata.utmMedium",
  "metadata.utm_medium",
  "metadata.utmMedium",
  "TrackingParameters.utm_medium",
  "TrackingParameters.utmMedium",
  "trackingParameters.utm_medium",
  "trackingParameters.utmMedium",
];

const UTM_CAMPAIGN_PATHS = [
  "utm_campaign",
  "utmCampaign",
  "data.utm_campaign",
  "data.utmCampaign",
  "data.metadata.utm_campaign",
  "data.metadata.utmCampaign",
  "data.order.utm_campaign",
  "data.order.utmCampaign",
  "data.order.metadata.utm_campaign",
  "data.order.metadata.utmCampaign",
  "metadata.utm_campaign",
  "metadata.utmCampaign",
  "TrackingParameters.utm_campaign",
  "TrackingParameters.utmCampaign",
  "trackingParameters.utm_campaign",
  "trackingParameters.utmCampaign",
];

const normalizeSaleLike = (payload: UnknownPayload): NormalizedSaleLike => {
  const topLevelId = stringCoalesce(payload, ["id", "event_id", "payload_id", "data.event_id"]);

  const saleId = stringCoalesce(payload, [
    "order_id",
    "order.id",
    "Order.id",
    "order.order_id",
    "Order.order_id",
    "data.order_id",
    "data.order.order_id",
    "data.order.orderId",
    "data.id",
    "data.sale_id",
    "data.order.id",
    "data.orderId",
    "id",
    "sale.id",
    "transaction.id",
    "charges.completed.0.order_id",
    "Subscription.charges.completed.0.order_id",
  ]);

  const orderRef = stringCoalesce(payload, [
    "order_ref",
    "order.ref",
    "order.reference",
    "Order.reference",
    "Order.order_ref",
    "data.reference",
    "data.order.reference",
    "data.order.ref",
  ]);

  const customerName = stringCoalesce(payload, [
    "Customer.full_name",
    "Customer.name",
    "customer.name",
    "Customer.first_name",
    "customer.first_name",
    "data.customer.name",
    "data.customer.full_name",
    "data.order.customer.name",
    "data.order.customer.full_name",
    "buyer.name",
    "data.buyer.name",
  ]);

  const customerEmail = stringCoalesce(payload, [
    "Customer.email",
    "customer.email",
    "data.customer.email",
    "data.order.customer.email",
    "buyer.email",
    "data.buyer.email",
  ]);

  const productName = stringCoalesce(payload, [
    "Product.product_name",
    "Product.name",
    "product.name",
    "data.product.name",
    "data.order.product.name",
    "items.0.product.name",
    "data.items.0.product.name",
    "data.order.items.0.product.name",
  ]);

  const {
    amount,
    grossAmount,
    netAmount,
    kiwifyCommissionAmount,
    affiliateCommissionAmount,
  } = resolveAmountFields(payload);

  const currency = stringCoalesce(payload, [
    "Commissions.currency",
    "commissions.currency",
    "currency",
    "data.currency",
    "data.amount.currency",
    "data.order.amount.currency",
    "data.order.currency",
    "transaction.currency",
    "data.transaction.currency",
    "order.currency",
    "Order.currency",
    "data.order.currency",
  ]);

  const paymentMethod = stringCoalesce(payload, [
    "payment_method",
    "payment.method",
    "data.payment.method",
    "data.order.payment.method",
    "transaction.payment_method",
    "data.transaction.payment_method",
    "charges.completed.0.payment_method",
    "Subscription.charges.completed.0.payment_method",
  ]);

  const status = stringCoalesce(payload, SALE_STATUS_PATHS);
  const role = stringCoalesce(payload, SALE_ROLE_PATHS);
  const customerPhone = stringCoalesce(payload, CUSTOMER_PHONE_PATHS);
  const customerDocument = stringCoalesce(payload, CUSTOMER_DOCUMENT_PATHS);
  const customerIp = stringCoalesce(payload, CUSTOMER_IP_PATHS);
  const utmSource = stringCoalesce(payload, UTM_SOURCE_PATHS);
  const utmMedium = stringCoalesce(payload, UTM_MEDIUM_PATHS);
  const utmCampaign = stringCoalesce(payload, UTM_CAMPAIGN_PATHS);

  const occurredAt = normalizeDate(payload, [
    "approved_date",
    "paid_at",
    "created_at",
    "updated_at",
    "data.paid_at",
    "data.created_at",
    "data.updated_at",
    "data.amount.paid_at",
    "data.payment.paid_at",
    "data.payment.paidAt",
    "data.payment.confirmed_at",
    "data.order.paid_at",
    "data.order.payment.paid_at",
    "data.order.payment.paidAt",
    "data.order.updated_at",
    "data.order.created_at",
    "transaction.paid_at",
    "data.transaction.paid_at",
    "event_time",
    "charges.completed.0.created_at",
    "Subscription.charges.completed.0.created_at",
  ]);

  const eventReference =
    saleId ??
    orderRef ??
    topLevelId ??
    fingerprint(payload);

  return {
    eventReference,
    saleId,
    customerName,
    customerEmail,
    productName,
    amount,
    grossAmount,
    netAmount,
    kiwifyCommissionAmount,
    affiliateCommissionAmount,
    currency,
    paymentMethod,
    status,
    role,
    customerPhone,
    customerDocument,
    customerIp,
    utmSource,
    utmMedium,
    utmCampaign,
    occurredAt,
    payload,
  };
};

export const normalizeApprovedSale = (
  payload: UnknownPayload,
): NormalizedApprovedSale => {
  return normalizeSaleLike(payload);
};

export const normalizePendingPayment = (
  payload: UnknownPayload,
): NormalizedPendingPayment => {
  return normalizeSaleLike(payload);
};

export const normalizeRejectedPayment = (
  payload: UnknownPayload,
): NormalizedRejectedPayment => {
  return normalizeSaleLike(payload);
};

export const normalizeRefundedSale = (
  payload: UnknownPayload,
): NormalizedRefundedSale => {
  return normalizeSaleLike(payload);
};

export const normalizeAbandonedCart = (
  payload: UnknownPayload,
): NormalizedAbandonedCart => {
  const cartId = stringCoalesce(payload, [
    "cart_id",
    "Cart.id",
    "cart.id",
    "checkout.id",
    "checkout_id",
    "data.id",
    "data.cart_id",
    "data.checkout.id",
    "data.checkout_id",
    "id",
  ]);

  const customerName = stringCoalesce(payload, [
    "Customer.full_name",
    "customer.name",
    "Customer.name",
    "name",
    "first_name",
    "data.customer.name",
    "data.customer.full_name",
    "buyer.name",
    "data.buyer.name",
    "data.checkout.customer.name",
  ]);

  const customerEmail = stringCoalesce(payload, [
    "Customer.email",
    "customer.email",
    "email",
    "data.customer.email",
    "buyer.email",
    "data.buyer.email",
    "data.checkout.customer.email",
  ]);

  const productName = stringCoalesce(payload, [
    "Product.product_name",
    "Product.name",
    "product.name",
    "product_name",
    "offer_name",
    "data.product.name",
    "items.0.product.name",
    "data.items.0.product.name",
    "data.checkout.items.0.product.name",
  ]);

  const {
    amount,
    grossAmount,
    netAmount,
    kiwifyCommissionAmount,
    affiliateCommissionAmount,
  } = resolveAmountFields(payload);

  const currency = stringCoalesce(payload, [
    "currency",
    "data.currency",
    "data.amount.currency",
    "order.currency",
    "Order.currency",
    "data.order.currency",
    "Commissions.currency",
    "data.checkout.currency",
    "data.checkout.amount.currency",
  ]);

  const checkoutUrl = stringCoalesce(payload, [
    "checkout_link",
    "Checkout.link",
    "Checkout.url",
    "checkout_url",
    "data.checkout_url",
    "checkout.url",
    "data.checkout.url",
    "data.url",
    "data.checkout_url",
    "data.checkout.checkout_url",
  ]);

  const status = stringCoalesce(payload, [
    "status",
    "data.status",
    "checkout.status",
    "data.checkout.status",
    "order_status",
    "order.status",
    "data.checkout.status",
  ]);

  const occurredAt = normalizeDate(payload, [
    "abandoned_at",
    "created_at",
    "data.abandoned_at",
    "data.created_at",
    "updated_at",
    "event_time",
    "data.updated_at",
    "data.timestamps.abandoned_at",
    "data.checkout.abandoned_at",
  ]);

  const eventLevelId = stringCoalesce(payload, [
    "event_id",
    "payload_id",
    "data.event_id",
    "id",
  ]);

  const eventReference =
    cartId ??
    checkoutUrl ??
    eventLevelId ??
    fingerprint(payload);

  return {
    eventReference,
    cartId,
    customerName,
    customerEmail,
    productName,
    amount,
    grossAmount,
    netAmount,
    kiwifyCommissionAmount,
    affiliateCommissionAmount,
    currency,
    checkoutUrl,
    status,
    occurredAt,
    payload,
  };
};

export const normalizeSubscriptionEvent = (
  payload: UnknownPayload,
): NormalizedSubscriptionEvent => {
  const base = normalizeSaleLike(payload);
  const subscriptionId = stringCoalesce(payload, [
    "subscription_id",
    "Subscription.id",
    "subscription.id",
    "Subscription.subscription_id",
    "data.id",
    "data.subscription_id",
    "data.subscription.id",
  ]);

  const subscriptionStatus = stringCoalesce(payload, [
    "Subscription.status",
    "subscription.status",
    "subscription_status",
    "data.subscription.status",
    "data.status",
  ]);

  const eventType = stringCoalesce(payload, [
    "webhook_event_type",
    "event_type",
    "event",
    "type",
    "data.event_type",
    "data.event",
  ]);

  const occurredAt =
    base.occurredAt ??
    normalizeDate(payload, [
      "subscription.updated_at",
      "Subscription.updated_at",
      "Subscription.start_date",
      "Subscription.next_payment",
      "data.subscription.updated_at",
      "data.subscription.next_payment",
      "data.updated_at",
    ]);

  const eventReference =
    subscriptionId ??
    base.saleId ??
    base.eventReference ??
    stringCoalesce(payload, ["id", "event_id", "payload_id"]) ??
    fingerprint(payload, eventType ?? subscriptionStatus ?? base.customerEmail ?? null);

  return {
    ...base,
    eventReference,
    occurredAt,
    subscriptionId,
    subscriptionStatus,
    eventType,
  };
};

export type EventKind =
  | "approved_sale"
  | "pending_payment"
  | "rejected_payment"
  | "refunded_sale"
  | "abandoned_cart"
  | "subscription_event";

const gatherCandidates = (payload: UnknownPayload, paths: string[]) => {
  const values: string[] = [];

  for (const path of paths) {
    const value = stringCoalesce(payload, [path]);
    if (value) {
      const normalized = value.toLowerCase();
      const sanitized = normalized.replace(/[^a-z0-9]+/g, "_");
      values.push(normalized);
      if (!values.includes(sanitized)) {
        values.push(sanitized);
      }
    }
  }

  return values;
};

const matchesAny = (candidates: string[], keywords: Set<string>) =>
  candidates.some((candidate) => keywords.has(candidate));

const KEYWORDS = {
  approved: new Set([
    "order_approved",
    "order.approved",
    "paid",
    "pagamento aprovado",
    "pagamento_aprovado",
    "compra aprovada",
    "compra_aprovada",
  ]),
  rejected: new Set([
    "order_rejected",
    "refused",
    "compra recusada",
    "compra_recusada",
  ]),
  refunded: new Set([
    "order_refunded",
    "refunded",
    "chargeback",
    "chargedback",
    "reembolso",
  ]),
  pending: new Set([
    "waiting_payment",
    "pix_created",
    "billet_created",
    "pix gerado",
    "pix_gerado",
    "boleto gerado",
    "boleto_gerado",
    "boleto e pix aguardando pagamento",
    "boleto_e_pix_aguardando_pagamento",
  ]),
  abandoned: new Set([
    "cart_abandoned",
    "checkout.abandoned",
    "checkout_abandoned",
    "abandoned",
    "carrinho abandonado",
    "carrinho_abandonado",
  ]),
  subscription: new Set([
    "subscription_canceled",
    "subscription_late",
    "subscription_renewed",
    "assinatura cancelada",
    "assinatura_cancelada",
    "assinatura atrasada",
    "assinatura_atrasada",
    "assinatura renovada",
    "assinatura_renovada",
  ]),
};

const EVENT_TYPE_PATHS = [
  "webhook_event_type",
  "webhook.event_type",
  "webhookEventType",
  "event_type",
  "eventType",
  "event",
  "type",
  "trigger",
  "data.webhook_event_type",
  "data.event_type",
  "data.event",
  "data.type",
  "order.webhook_event_type",
  "Order.webhook_event_type",
];

const STATUS_PATHS = [
  "order_status",
  "order.status",
  "Order.status",
  "order.order_status",
  "Order.order_status",
  "status",
  "Status",
  "payment_status",
  "payment.status",
  "Payment.status",
  "sale.status",
  "transaction.status",
  "Subscription.status",
  "subscription.status",
  "subscription_status",
  "charges.completed.0.status",
  "reason",
  "card_rejection_reason",
  "data.status",
  "data.order.status",
  "data.order.order_status",
  "data.payment.status",
  "order.webhook_event_type",
  "order.webhookEventType",
];

export const detectEventKind = (payload: UnknownPayload): EventKind | null => {
  const eventTypes = gatherCandidates(payload, EVENT_TYPE_PATHS);
  const statuses = gatherCandidates(payload, STATUS_PATHS);
  const combined = [...eventTypes, ...statuses];

  if (matchesAny(combined, KEYWORDS.subscription)) {
    return "subscription_event";
  }

  if (matchesAny(combined, KEYWORDS.abandoned)) {
    return "abandoned_cart";
  }

  if (matchesAny(combined, KEYWORDS.refunded)) {
    return "refunded_sale";
  }

  if (matchesAny(combined, KEYWORDS.rejected)) {
    return "rejected_payment";
  }

  if (matchesAny(combined, KEYWORDS.pending)) {
    return "pending_payment";
  }

  if (matchesAny(combined, KEYWORDS.approved)) {
    return "approved_sale";
  }

  return null;
};
