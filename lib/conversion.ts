import type { Sale } from './types';

export const getConversionLabel = (sale: Sale): string => {
  if (sale.abandoned_before_payment) {
    return 'Aprovado retorno';
  }

  return 'Aprovado direto';
};
