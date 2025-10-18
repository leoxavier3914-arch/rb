import Link from "next/link"
import { notFound } from "next/navigation"

import SaleDetailsTabs, { type DetailItem, type DetailListItem } from "@/components/sale-details-tabs"

import { formatCurrency, formatDate } from "@/lib/format"
import { getSaleDetails, type SaleDetailRecord } from "@/lib/queries"
import {
  formatSaleRole,
  formatSaleStatus,
  normalizeSaleMetadataValue,
  resolveSaleDocumentLabel,
} from "@/lib/sale-event-metadata"

export const dynamic = "force-dynamic"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  credit_card: "Cartão de crédito",
  pix: "Pix",
  boleto: "Boleto bancário",
  bank_transfer: "Transferência bancária",
  paypal: "PayPal",
}

const PAYMENT_METHOD_PATHS = [
  "payment_method",
  "payment.method",
  "data.payment_method",
  "data.payment.method",
  "data.order.payment_method",
  "data.order.payment.method",
  "data.order.payment.method_name",
  "payment.method_name",
  "payment.methodName",
]

const STATUS_PATHS = [
  "data.status",
  "data.order.status",
  "data.order.payment.status",
  "data.payment.status",
  "transaction.status",
]

const ROLE_PATHS = [
  "role",
  "data.role",
  "data.order.role",
  "metadata.role",
  "sale_type",
  "saleType",
  "data.sale_type",
  "data.saleType",
  "data.order.sale_type",
  "data.order.saleType",
  "Sale.sale_type",
  "Sale.saleType",
]

const INSTALLMENT_PATHS = [
  "data.payment.installments",
  "data.order.payment.installments",
  "payment.installments",
  "payment.parcelas",
  "payment_details.installments",
  "installments",
  "data.payment.number_installments",
]

const PHONE_PATHS = [
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
]

const DOCUMENT_PATHS = [
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
]

const IP_PATHS = [
  "customer.ip",
  "client_ip",
  "data.client_ip",
  "data.customer.ip",
  "data.order.customer.ip",
  "request.ip",
]

const UTM_SOURCE_PATHS = [
  "utm_source",
  "utmSource",
  "data.utm_source",
  "data.utmSource",
  "TrackingParameters.utm_source",
  "TrackingParameters.utmSource",
  "trackingParameters.utm_source",
  "trackingParameters.utmSource",
  "data.order.utm_source",
  "data.order.utmSource",
  "data.order.metadata.utm_source",
  "data.order.metadata.utmSource",
  "metadata.utm_source",
  "metadata.utmSource",
]

const UTM_MEDIUM_PATHS = [
  "utm_medium",
  "utmMedium",
  "data.utm_medium",
  "data.utmMedium",
  "TrackingParameters.utm_medium",
  "TrackingParameters.utmMedium",
  "trackingParameters.utm_medium",
  "trackingParameters.utmMedium",
  "data.order.utm_medium",
  "data.order.utmMedium",
  "data.order.metadata.utm_medium",
  "data.order.metadata.utmMedium",
  "metadata.utm_medium",
  "metadata.utmMedium",
]

const UTM_CAMPAIGN_PATHS = [
  "utm_campaign",
  "utmCampaign",
  "data.utm_campaign",
  "data.utmCampaign",
  "TrackingParameters.utm_campaign",
  "TrackingParameters.utmCampaign",
  "trackingParameters.utm_campaign",
  "trackingParameters.utmCampaign",
  "data.order.utm_campaign",
  "data.order.utmCampaign",
  "data.order.metadata.utm_campaign",
  "data.order.metadata.utmCampaign",
  "metadata.utm_campaign",
  "metadata.utmCampaign",
]

const PAYOUT_STATUS_PATHS = [
  "payout_status",
  "withdrawal_status",
  "data.payout_status",
  "data.order.payout_status",
  "data.order.withdrawal_status",
]

const PAYOUT_DATE_PATHS = [
  "expected_release_at",
  "expected_release_date",
  "release_date",
  "release_at",
  "data.expected_release_at",
  "data.expected_release_date",
  "data.payment.expected_release_at",
  "data.payment.release_date",
  "data.order.release_date",
  "next_withdrawal_at",
]

const SALE_KIND_BADGE: Record<SaleDetailRecord['kind'], { label: string; tone: string }> = {
  approved: { label: "Venda aprovada", tone: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40" },
  pending: { label: "Pagamento pendente", tone: "bg-amber-500/20 text-amber-200 border-amber-400/40" },
  rejected: { label: "Pagamento recusado", tone: "bg-rose-500/20 text-rose-200 border-rose-400/40" },
  refunded: { label: "Venda reembolsada", tone: "bg-sky-500/20 text-sky-200 border-sky-400/40" },
}

const PIX_CODE_PATHS = [
  "pix_code",
  "pixCode",
  "pix.qr_code",
  "pix.qrCode",
  "data.pix_code",
  "data.pixCode",
  "data.pix.qr_code",
  "data.pix.qrCode",
  "data.payment.pix_code",
  "data.payment.pixCode",
  "data.payment.qr_code",
  "data.payment.qrCode",
  "data.order.pix_code",
  "data.order.pixCode",
  "data.order.payment.pix_code",
  "data.order.payment.pixCode",
  "data.order.payment.qr_code",
  "data.order.payment.qrCode",
  "payment.pix_code",
  "payment.pixCode",
  "payment.qr_code",
  "payment.qrCode",
]

const PIX_EXPIRATION_PATHS = [
  "pix_expiration",
  "pixExpiration",
  "pix.expiration",
  "pix.expira_em",
  "pix.expiraEm",
  "data.pix_expiration",
  "data.pixExpiration",
  "data.pix.expiration",
  "data.pix.expira_em",
  "data.pix.expiraEm",
  "data.payment.pix_expiration",
  "data.payment.pixExpiration",
  "data.payment.expiration",
  "data.payment.expira_em",
  "data.payment.expiraEm",
  "data.order.pix_expiration",
  "data.order.pixExpiration",
  "data.order.payment.pix_expiration",
  "data.order.payment.pixExpiration",
  "data.order.payment.expiration",
  "data.order.payment.expira_em",
  "data.order.payment.expiraEm",
  "payment.pix_expiration",
  "payment.pixExpiration",
  "payment.expiration",
  "payment.expira_em",
  "payment.expiraEm",
]

type UnknownPayload = Record<string, unknown>

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const getNestedValue = (payload: UnknownPayload, path: string): unknown => {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) {
      return undefined
    }

    if (Array.isArray(acc)) {
      const index = Number(key)
      if (!Number.isNaN(index)) {
        return acc[index]
      }
      return undefined
    }

    if (isObject(acc) && key in acc) {
      return acc[key]
    }

    return undefined
  }, payload)
}

const pickStringFromSources = (sources: UnknownPayload[], paths: string[]): string | null => {
  for (const path of paths) {
    for (const source of sources) {
      const value = getNestedValue(source, path)
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim()
      }
    }
  }
  return null
}

const pickStringFromEntries = (entries: SaleDetailRecord[], paths: string[]): string | null => {
  for (const entry of entries) {
    const sources: UnknownPayload[] = [entry as unknown as UnknownPayload, entry.payload]
    const candidate = pickStringFromSources(sources, paths)
    if (candidate) {
      return candidate
    }
  }
  return null
}

const pickNumberFromSources = (sources: UnknownPayload[], paths: string[]): number | null => {
  for (const path of paths) {
    for (const source of sources) {
      const value = getNestedValue(source, path)

      if (typeof value === "number" && Number.isFinite(value)) {
        return value
      }

      if (typeof value === "string") {
        const normalized = value.replace(/[^0-9.,-]/g, "").replace(",", ".")
        if (normalized.length === 0) continue
        const parsed = Number(normalized)
        if (!Number.isNaN(parsed)) {
          return parsed
        }
      }
    }
  }
  return null
}

const pickNumber = (payload: UnknownPayload, paths: string[]): number | null =>
  pickNumberFromSources([payload], paths)

const pickNumberFromEntries = (entries: SaleDetailRecord[], paths: string[]): number | null => {
  for (const entry of entries) {
    const sources: UnknownPayload[] = [entry as unknown as UnknownPayload, entry.payload]
    const candidate = pickNumberFromSources(sources, paths)
    if (candidate !== null) {
      return candidate
    }
  }
  return null
}

const formatInstallments = (value: number | null): string | null => {
  if (value === null) return null
  if (value <= 1) return "1 (à vista)"
  return `${value}`
}

const formatPaymentMethod = (paymentMethod: string | null | undefined) => {
  if (!paymentMethod) return null
  const lower = paymentMethod.toLowerCase()
  return PAYMENT_METHOD_LABELS[lower] ?? paymentMethod.toUpperCase()
}

const formatPixExpirationValue = (value: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const formatted = formatDate(trimmed)
  if (formatted) {
    return formatted
  }

  const normalizedIsoLike = formatDate(trimmed.replace(" ", "T"))
  if (normalizedIsoLike) {
    return normalizedIsoLike
  }

  const match = trimmed.match(/^(\d{2})[\/](\d{2})[\/](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (match) {
    const [, day, month, year, hour = "00", minute = "00", second = "00"] = match
    const isoCandidate = `${year}-${month}-${day}T${hour}:${minute}:${second}`
    const normalized = formatDate(isoCandidate)
    if (normalized) {
      return normalized
    }
  }

  return trimmed
}

const buildSaleItems = (entries: SaleDetailRecord[], primary: SaleDetailRecord): DetailItem[] => {
  const statusCandidate = primary.status ?? pickStringFromEntries(entries, STATUS_PATHS)
  const status = formatSaleStatus(statusCandidate)
  const roleCandidate = primary.role ?? pickStringFromEntries(entries, ROLE_PATHS)
  const role = formatSaleRole(roleCandidate)
  const installments = pickNumberFromEntries(entries, INSTALLMENT_PATHS)
  const paymentMethodCandidate =
    primary.payment_method ?? pickStringFromEntries(entries, PAYMENT_METHOD_PATHS)
  const paymentMethod = formatPaymentMethod(paymentMethodCandidate)
  const isPixPayment = paymentMethodCandidate?.toLowerCase() === "pix"
  const pixCode = isPixPayment ? pickStringFromEntries(entries, PIX_CODE_PATHS) : null
  const pixExpirationRaw = isPixPayment ? pickStringFromEntries(entries, PIX_EXPIRATION_PATHS) : null
  const pixExpirationDisplay = formatPixExpirationValue(pixExpirationRaw)
  const createdAt = pickStringFromEntries(entries, [
    "created_at",
    "data.created_at",
    "data.order.created_at",
    "data.createdAt",
    "data.order.createdAt",
  ])

  const items: DetailItem[] = [
    { label: "ID da venda", value: (primary.sale_id ?? primary.id)?.toString() ?? null },
    { label: "Status", value: status },
    { label: "Categoria", value: SALE_KIND_BADGE[primary.kind]?.label ?? primary.label ?? null },
    { label: "Tipo", value: role },
    {
      label: "Produto",
      value:
        primary.product_name ??
        pickStringFromEntries(entries, ["product.name", "Product.name", "data.product.name", "data.order.product.name"]),
    },
    { label: "Método de pagamento", value: paymentMethod },
  ]

  if (isPixPayment && (pixExpirationDisplay ?? pixExpirationRaw ?? pixCode)) {
    items.push({
      label: "Expiração do PIX",
      value: pixExpirationDisplay ?? pixExpirationRaw,
      action: pixCode
        ? { type: "pix-qr", pixCode, expiresAt: pixExpirationDisplay ?? pixExpirationRaw ?? null }
        : undefined,
    })
  }

  items.push(
    { label: "Parcelas", value: formatInstallments(installments) },
    { label: "Data de criação", value: formatDate(createdAt ?? primary.created_at) },
  )

  return items
}

const buildCustomerItems = (entries: SaleDetailRecord[], primary: SaleDetailRecord): DetailItem[] => {
  const phoneCandidate = primary.customer_phone ?? pickStringFromEntries(entries, PHONE_PATHS)
  const phone = normalizeSaleMetadataValue(phoneCandidate)
  const documentCandidate = primary.customer_document ?? pickStringFromEntries(entries, DOCUMENT_PATHS)
  const documentLabel = resolveSaleDocumentLabel(documentCandidate)
  const document = normalizeSaleMetadataValue(documentCandidate)
  const ipCandidate = primary.customer_ip ?? pickStringFromEntries(entries, IP_PATHS)
  const ip = normalizeSaleMetadataValue(ipCandidate)
  const utmSourceCandidate = primary.utm_source ?? pickStringFromEntries(entries, UTM_SOURCE_PATHS)
  const utmSource = normalizeSaleMetadataValue(utmSourceCandidate)
  const utmMediumCandidate = primary.utm_medium ?? pickStringFromEntries(entries, UTM_MEDIUM_PATHS)
  const utmMedium = normalizeSaleMetadataValue(utmMediumCandidate)
  const utmCampaignCandidate = primary.utm_campaign ?? pickStringFromEntries(entries, UTM_CAMPAIGN_PATHS)
  const utmCampaign = normalizeSaleMetadataValue(utmCampaignCandidate)

  return [
    { label: "Nome", value: primary.customer_name },
    { label: "Email", value: primary.customer_email },
    { label: "Celular", value: phone },
    { label: documentLabel, value: document },
    { label: "IP", value: ip },
    { label: "UTM Source", value: utmSource },
    { label: "UTM Medium", value: utmMedium },
    { label: "UTM Campaign", value: utmCampaign },
  ]
}

const buildValueItems = (entries: SaleDetailRecord[], primary: SaleDetailRecord): DetailItem[] => {
  const currency = primary.currency
  const netDisplay = formatCurrency(primary.net_amount ?? primary.amount, currency)
  const grossDisplay = formatCurrency(primary.gross_amount ?? primary.amount, currency)
  const kiwifyDisplay = formatCurrency(primary.kiwify_commission_amount, currency)
  const affiliateDisplay = formatCurrency(primary.affiliate_commission_amount, currency)
  const payoutStatus = pickStringFromEntries(entries, PAYOUT_STATUS_PATHS)
  const payoutDate = pickStringFromEntries(entries, PAYOUT_DATE_PATHS)

  let feesDisplay: string | null = null
  if (
    primary.gross_amount !== null &&
    primary.gross_amount !== undefined &&
    primary.net_amount !== null &&
    primary.net_amount !== undefined
  ) {
    const fees = Number(primary.gross_amount) - Number(primary.net_amount)
    if (!Number.isNaN(fees) && Math.abs(fees) > 0.009) {
      feesDisplay = formatCurrency(fees, currency)
    }
  }

  const breakdownCandidates: { label: string; value: string | null }[] = [
    { label: "Produtor", value: netDisplay },
    { label: "Kiwify", value: kiwifyDisplay },
    { label: "Afiliados", value: affiliateDisplay },
  ]

  const breakdown: DetailListItem[] = breakdownCandidates
    .filter((item): item is { label: string; value: string } => item.value !== null)
    .map((item) => ({ label: item.label, value: item.value }))

  return [
    { label: "Valor líquido", value: netDisplay },
    { label: "Valor cheio", value: grossDisplay },
    { label: "Taxas estimadas", value: feesDisplay },
    {
      label: "Divisão dos valores",
      value: null,
      list: breakdown.length > 0 ? breakdown : undefined,
    },
    { label: "Situação do recebimento", value: payoutStatus },
    { label: "Data de liberação", value: formatDate(payoutDate) },
  ]
}

const Timeline = ({ entries }: { entries: SaleDetailRecord[] }) => {
  if (entries.length <= 1) return null

  return (
    <section className="rounded-3xl border border-surface-accent/30 bg-surface-accent/40 p-6">
      <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Histórico do pedido</h3>
      <ol className="mt-4 space-y-4">
        {entries.map((entry) => {
          const badge = SALE_KIND_BADGE[entry.kind]
          const amountDisplay = formatCurrency(entry.net_amount ?? entry.amount, entry.currency)
          return (
            <li key={`${entry.table}-${entry.id}`} className="rounded-2xl border border-surface-accent/40 bg-surface/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-primary-foreground">{badge?.label ?? entry.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(entry.occurred_at ?? entry.created_at) ?? "Data indisponível"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  {badge ? (
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] ${badge.tone}`}
                    >
                      {badge.label}
                    </span>
                  ) : null}
                  {amountDisplay ? <span className="text-sm font-medium text-primary">{amountDisplay}</span> : null}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default async function SaleDetailsPage({
  params,
  searchParams,
}: {
  params: { saleId: string }
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const saleId = decodeURIComponent(params.saleId)
  const details = await getSaleDetails(saleId)

  if (!details) {
    notFound()
  }

  const entryParam = searchParams?.entry
  const entryId = Array.isArray(entryParam) ? entryParam[0] : entryParam

  const { entries } = details
  const primary = entryId
    ? entries.find((entry) => entry.id === entryId) ?? details.primary
    : details.primary

  const saleItems = buildSaleItems(entries, primary)
  const customerItems = buildCustomerItems(entries, primary)
  const valueItems = buildValueItems(entries, primary)
  const sections = [
    { id: "sale", label: "Venda", items: saleItems },
    { id: "customer", label: "Cliente", items: customerItems },
    { id: "values", label: "Valores", items: valueItems },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Detalhes da venda</p>
          <h1 className="text-3xl font-semibold text-primary-foreground">
            {primary.product_name ?? "Registro da Kiwify"}
          </h1>
        </div>
        <Link
          href="/approved-sales"
          className="inline-flex items-center gap-2 rounded-full border border-surface-accent/60 bg-surface-accent px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
        >
          ← Voltar para o hub
        </Link>
      </header>

      <SaleDetailsTabs sections={sections} />

      <Timeline entries={entries} />

      <section className="rounded-3xl border border-surface-accent/20 bg-surface/50 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Payload bruto</h3>
        <pre className="mt-4 max-h-[480px] overflow-auto rounded-2xl bg-black/30 p-4 text-xs leading-relaxed text-muted-foreground">
          {JSON.stringify(primary.payload, null, 2)}
        </pre>
      </section>
    </div>
  )
}
