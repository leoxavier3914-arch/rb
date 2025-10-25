export interface ProductRow {
  readonly id: string;
  readonly title: string;
  readonly price_cents: number;
  readonly currency: string;
  readonly active: boolean;
  readonly created_at: string | null;
  readonly updated_at: string | null;
  readonly raw: unknown;
}

export function mapProductPayload(payload: Record<string, unknown>): ProductRow {
  return {
    id: String(payload.id ?? ''),
    title: String(payload.title ?? ''),
    price_cents: Number(payload.price_cents ?? payload.price ?? 0),
    currency: String(payload.currency ?? 'BRL'),
    active: Boolean(payload.active ?? true),
    created_at: payload.created_at ? new Date(String(payload.created_at)).toISOString() : null,
    updated_at: payload.updated_at ? new Date(String(payload.updated_at)).toISOString() : null,
    raw: payload
  };
}
