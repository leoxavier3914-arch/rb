export type WebhookTrigger =
  | 'boleto_gerado'
  | 'pix_gerado'
  | 'carrinho_abandonado'
  | 'compra_recusada'
  | 'compra_aprovada'
  | 'compra_reembolsada'
  | 'chargeback'
  | 'subscription_canceled'
  | 'subscription_late'
  | 'subscription_renewed';

export interface WebhookTriggerOption {
  readonly value: WebhookTrigger;
  readonly label: string;
  readonly description: string;
}

export const WEBHOOK_TRIGGER_OPTIONS: readonly WebhookTriggerOption[] = [
  {
    value: 'boleto_gerado',
    label: 'Boleto gerado',
    description: 'Disparado quando um boleto é criado para o pedido.'
  },
  {
    value: 'pix_gerado',
    label: 'Pix gerado',
    description: 'Enviado assim que uma cobrança Pix é gerada.'
  },
  {
    value: 'carrinho_abandonado',
    label: 'Carrinho abandonado',
    description: 'Notifica quando o comprador não conclui o checkout.'
  },
  {
    value: 'compra_recusada',
    label: 'Compra recusada',
    description: 'Emitido quando o pagamento é recusado pelo meio de pagamento.'
  },
  {
    value: 'compra_aprovada',
    label: 'Compra aprovada',
    description: 'Disparado quando o pagamento do pedido é aprovado.'
  },
  {
    value: 'compra_reembolsada',
    label: 'Compra reembolsada',
    description: 'Enviado quando o pedido tem o valor reembolsado.'
  },
  {
    value: 'chargeback',
    label: 'Chargeback',
    description: 'Notifica quando ocorre um chargeback no pedido.'
  },
  {
    value: 'subscription_canceled',
    label: 'Assinatura cancelada',
    description: 'Emitido quando uma assinatura recorrente é cancelada.'
  },
  {
    value: 'subscription_late',
    label: 'Assinatura inadimplente',
    description: 'Disparado quando o pagamento recorrente está atrasado.'
  },
  {
    value: 'subscription_renewed',
    label: 'Assinatura renovada',
    description: 'Enviado quando a cobrança recorrente é renovada com sucesso.'
  }
];

const TRIGGER_ORDER = new Map<WebhookTrigger, number>(
  WEBHOOK_TRIGGER_OPTIONS.map((option, index) => [option.value, index])
);

export function normalizeWebhookTriggers(values: readonly unknown[]): readonly WebhookTrigger[] {
  const seen = new Set<WebhookTrigger>();

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = value.trim() as WebhookTrigger;
    if (!TRIGGER_ORDER.has(normalized)) {
      continue;
    }

    seen.add(normalized);
  }

  return Array.from(seen).sort((a, b) => TRIGGER_ORDER.get(a)! - TRIGGER_ORDER.get(b)!);
}

export function toggleWebhookTrigger(
  values: readonly WebhookTrigger[],
  trigger: WebhookTrigger
): readonly WebhookTrigger[] {
  const set = new Set(values);

  if (set.has(trigger)) {
    set.delete(trigger);
  } else {
    set.add(trigger);
  }

  return Array.from(set).sort((a, b) => TRIGGER_ORDER.get(a)! - TRIGGER_ORDER.get(b)!);
}
