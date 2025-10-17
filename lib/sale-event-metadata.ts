import type { SaleEventBase } from "./queries";

export interface SaleMetadataDetail {
  label: string;
  value: string;
}

type SaleMetadataCarrier = Pick<
  SaleEventBase,
  |
    "status"
    | "role"
    | "customer_phone"
    | "customer_document"
    | "customer_ip"
    | "utm_source"
    | "utm_medium"
    | "utm_campaign"
>;

const STATUS_LABELS: Record<string, string> = {
  approved: "Aprovado",
  confirmed: "Confirmado",
  pending: "Pendente",
  waiting_payment: "Aguardando pagamento",
  paid: "Pago",
  unpaid: "Não pago",
  refunded: "Reembolsado",
  refund_pending: "Reembolso pendente",
  chargeback: "Chargeback",
  contested: "Em contestação",
  canceled: "Cancelado",
  failed: "Falhou",
  processing: "Processando",
  complete: "Completo",
  incomplete: "Incompleto",
  expired: "Expirado",
};

const ROLE_LABELS: Record<string, string> = {
  producer: "Produtor",
  co_producer: "Coprodutor",
  affiliate: "Afiliado",
  co_affiliate: "Coafiliado",
  manager: "Gerente",
  customer: "Cliente",
};

const humanize = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

export const normalizeSaleMetadataValue = (
  value: string | null | undefined,
): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const formatSaleStatus = (
  status: string | null | undefined,
): string | null => {
  const normalized = normalizeSaleMetadataValue(status);
  if (!normalized) {
    return null;
  }

  const key = normalized.toLowerCase();
  return STATUS_LABELS[key] ?? humanize(normalized);
};

export const formatSaleRole = (
  role: string | null | undefined,
): string | null => {
  const normalized = normalizeSaleMetadataValue(role);
  if (!normalized) {
    return null;
  }

  const key = normalized.toLowerCase();
  return ROLE_LABELS[key] ?? humanize(normalized);
};

export const buildSaleMetadataDetails = (
  sale: SaleMetadataCarrier,
): SaleMetadataDetail[] => {
  const details: SaleMetadataDetail[] = [];

  const status = formatSaleStatus(sale.status);
  if (status) {
    details.push({ label: "Status", value: status });
  }

  const role = formatSaleRole(sale.role);
  if (role) {
    details.push({ label: "Tipo", value: role });
  }

  const document = normalizeSaleMetadataValue(sale.customer_document);
  if (document) {
    details.push({ label: "Documento", value: document });
  }

  const phone = normalizeSaleMetadataValue(sale.customer_phone);
  if (phone) {
    details.push({ label: "Celular", value: phone });
  }

  const ip = normalizeSaleMetadataValue(sale.customer_ip);
  if (ip) {
    details.push({ label: "IP", value: ip });
  }

  const utmSource = normalizeSaleMetadataValue(sale.utm_source);
  if (utmSource) {
    details.push({ label: "UTM Source", value: utmSource });
  }

  const utmMedium = normalizeSaleMetadataValue(sale.utm_medium);
  if (utmMedium) {
    details.push({ label: "UTM Medium", value: utmMedium });
  }

  const utmCampaign = normalizeSaleMetadataValue(sale.utm_campaign);
  if (utmCampaign) {
    details.push({ label: "UTM Campaign", value: utmCampaign });
  }

  return details;
};
