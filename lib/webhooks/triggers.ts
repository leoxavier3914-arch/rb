export type WebhookEventTrigger =
  | 'sale.created'
  | 'sale.pending'
  | 'sale.approved'
  | 'sale.overdue'
  | 'sale.completed'
  | 'sale.canceled'
  | 'sale.refunded'
  | 'sale.chargeback';

export interface WebhookEventOption {
  readonly value: WebhookEventTrigger;
  readonly label: string;
  readonly description: string;
}

export const WEBHOOK_EVENT_OPTIONS: readonly WebhookEventOption[] = [
  {
    value: 'sale.created',
    label: 'Venda criada',
    description: 'Disparado imediatamente após a criação de um pedido.'
  },
  {
    value: 'sale.pending',
    label: 'Pagamento pendente',
    description: 'Emitido quando uma venda permanece aguardando pagamento.'
  },
  {
    value: 'sale.approved',
    label: 'Pagamento aprovado',
    description: 'Enviado assim que o pagamento do pedido é confirmado.'
  },
  {
    value: 'sale.overdue',
    label: 'Pagamento atrasado',
    description: 'Disparado quando o boleto ou parcelamento expira sem pagamento.'
  },
  {
    value: 'sale.completed',
    label: 'Venda concluída',
    description: 'Notifica a conclusão da entrega ou liberação do produto.'
  },
  {
    value: 'sale.canceled',
    label: 'Venda cancelada',
    description: 'Enviado quando o pedido é cancelado pelo comprador ou suporte.'
  },
  {
    value: 'sale.refunded',
    label: 'Venda reembolsada',
    description: 'Disparado quando o valor pago é devolvido ao cliente.'
  },
  {
    value: 'sale.chargeback',
    label: 'Chargeback',
    description: 'Emitido quando ocorre um estorno por contestação junto ao meio de pagamento.'
  }
];

const EVENT_ORDER = new Map<WebhookEventTrigger, number>(
  WEBHOOK_EVENT_OPTIONS.map((option, index) => [option.value, index])
);

export function normalizeWebhookEvents(values: readonly unknown[]): readonly WebhookEventTrigger[] {
  const seen = new Set<WebhookEventTrigger>();

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = value.trim() as WebhookEventTrigger;
    if (!EVENT_ORDER.has(normalized)) {
      continue;
    }

    seen.add(normalized);
  }

  return Array.from(seen).sort((a, b) => EVENT_ORDER.get(a)! - EVENT_ORDER.get(b)!);
}

export function toggleWebhookEvent(
  values: readonly WebhookEventTrigger[],
  event: WebhookEventTrigger
): readonly WebhookEventTrigger[] {
  const set = new Set(values);

  if (set.has(event)) {
    set.delete(event);
  } else {
    set.add(event);
  }

  return Array.from(set).sort((a, b) => EVENT_ORDER.get(a)! - EVENT_ORDER.get(b)!);
}
