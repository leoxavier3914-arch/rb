import type { Sale } from './types';

const DIRECT_PURCHASE_SOURCE = 'kiwify.webhook_purchase';

export const getConversionLabel = (sale: Sale): string => {
  if (sale.abandoned_before_payment) {
    return 'Aprovado retorno';
  }

  if (sale.email_follow_up) {
    return 'Aprovado retorno';
  }

  const source = sale.source?.toLowerCase() ?? '';
  if (source && source !== DIRECT_PURCHASE_SOURCE) {
    return 'Carrinho recuperado';
  }

  return 'Aprovado direto';
};
