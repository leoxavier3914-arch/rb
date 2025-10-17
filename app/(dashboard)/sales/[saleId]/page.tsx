import Link from "next/link"
import { notFound } from "next/navigation"

import SaleDetailsTabs, { type DetailItem, type DetailListItem } from "@/components/sale-details-tabs"

import { formatCurrency, formatDate } from "@/lib/format"
import { getSaleDetails, type SaleDetailRecord } from "@/lib/queries"

export const dynamic = "force-dynamic"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  credit_card: "Cartão de crédito",
  pix: "Pix",
  boleto: "Boleto bancário",
  bank_transfer: "Transferência bancária",
  paypal: "PayPal",
}

const STATUS_PATHS = [
  "status",
  "data.status",
  "data.order.status",
  "data.order.payment.status",
  "data.payment.status",
  "sale.status",
  "transaction.status",
]

const ROLE_PATHS = [
  "data.role",
  "role",
  "data.order.role",
  "order.role",
  "metadata.role",
]

const INSTALLMENT_PATHS = [
  "data.payment.installments",
  "data.order.payment.installments",
  "payment.installments",
  "payment.parcelas",
  "payment_details.installments",
  "installments",
  "parcelas",
  "data.payment.number_installments",
]

const PHONE_PATHS = [
  "customer.phone",
  "customer.phone_number",
  "Customer.phone",
  "Customer.phone_number",
  "data.customer.phone",
  "data.customer.phone_number",
  "data.order.customer.phone",
  "data.order.customer.phone_number",
  "buyer.phone",
  "buyer.phone_number",
  "customer_phone",
  "customer_phone_number",
  "customer_phone_1",
  "customer_phone_2",
  "customer_phone_3",
  "customer_phone1",
  "customer_phone2",
  "customer_phone3",
]

const DOCUMENT_PATHS = [
  "customer.document",
  "customer.cpf",
  "customer.tax_id",
  "Customer.document",
  "Customer.cpf",
  "Customer.tax_id",
  "data.customer.document",
  "data.customer.cpf",
  "data.order.customer.document",
  "data.order.customer.cpf",
  "buyer.document",
  "buyer.cpf",
  "customer_document",
  "customer_document_number",
  "customer_cpf_number",
]

const IP_PATHS = [
  "customer.ip",
  "Customer.ip",
  "buyer.ip",
  "client_ip",
  "data.client_ip",
  "data.customer.ip",
  "data.order.customer.ip",
  "request.ip",
]

const UTM_SOURCE_PATHS = [
  "utm_source",
  "data.utm_source",
  "data.order.utm_source",
  "data.order.metadata.utm_source",
  "metadata.utm_source",
]

const UTM_MEDIUM_PATHS = [
  "utm_medium",
  "data.utm_medium",
  "data.order.utm_medium",
  "data.order.metadata.utm_medium",
  "metadata.utm_medium",
]

const UTM_CAMPAIGN_PATHS = [
  "utm_campaign",
  "data.utm_campaign",
  "data.order.utm_campaign",
  "data.order.metadata.utm_campaign",
  "metadata.utm_campaign",
]

const PAYOUT_STATUS_PATHS = [
  "payout_status",
  "withdrawal_status",
  "data.payout_status",
  "data.withdrawal_status",
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
  "data.order.expected_release_at",
  "data.order.release_date",
  "data.payment.release_date",
  "next_withdrawal_at",
]

const SALE_KIND_BADGE: Record<SaleDetailRecord['kind'], { label: string; tone: string }> = {
  approved: { label: "Venda aprovada", tone: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40" },
  pending: { label: "Pagamento pendente", tone: "bg-amber-500/20 text-amber-200 border-amber-400/40" },
  rejected: { label: "Pagamento recusado", tone: "bg-rose-500/20 text-rose-200 border-rose-400/40" },
  refunded: { label: "Venda reembolsada", tone: "bg-sky-500/20 text-sky-200 border-sky-400/40" },
}

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

const buildSaleItems = (entries: SaleDetailRecord[], primary: SaleDetailRecord): DetailItem[] => {
  const status = pickStringFromEntries(entries, STATUS_PATHS)
  const role = pickStringFromEntries(entries, ROLE_PATHS)
  const installments = pickNumberFromEntries(entries, INSTALLMENT_PATHS)
  const createdAt = pickStringFromEntries(entries, [
    "created_at",
    "data.created_at",
    "data.order.created_at",
    "data.createdAt",
    "data.order.createdAt",
  ])

  return [
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
    { label: "Método de pagamento", value: formatPaymentMethod(primary.payment_method) },
    { label: "Parcelas", value: formatInstallments(installments) },
    { label: "Data de criação", value: formatDate(createdAt ?? primary.created_at) },
  ]
}

const buildCustomerItems = (entries: SaleDetailRecord[], primary: SaleDetailRecord): DetailItem[] => {
  const phone = pickStringFromEntries(entries, PHONE_PATHS)
  const document = pickStringFromEntries(entries, DOCUMENT_PATHS)
  const ip = pickStringFromEntries(entries, IP_PATHS)
  const utmSource = pickStringFromEntries(entries, UTM_SOURCE_PATHS)
  const utmMedium = pickStringFromEntries(entries, UTM_MEDIUM_PATHS)
  const utmCampaign = pickStringFromEntries(entries, UTM_CAMPAIGN_PATHS)

  return [
    { label: "Nome", value: primary.customer_name },
    { label: "Email", value: primary.customer_email },
    { label: "Celular", value: phone },
    { label: "Documento", value: document },
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
}: {
  params: { saleId: string }
}) {
  const saleId = decodeURIComponent(params.saleId)
  const details = await getSaleDetails(saleId)

  if (!details) {
    notFound()
  }

  const { primary, entries } = details
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
