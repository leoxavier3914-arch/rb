import type { Sale } from './types';

const DIRECT_PURCHASE_SOURCE = 'kiwify.webhook_purchase';

export const getConversionLabel = (sale: Sale): string => {
  const source = sale.source?.toLowerCase() ?? '';
  const hasRemarketing =
    sale.email_follow_up || (source && source !== DIRECT_PURCHASE_SOURCE);

  if (hasRemarketing) {
    return 'Carrinho recuperado';
  }

  if (sale.abandoned_before_payment) {
    return 'Aprovado retorno';
  }

  return 'Aprovado direto';
};
