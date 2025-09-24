import { describe, expect, it } from 'vitest';
import { extractTrafficSource } from './traffic';

const baseCheckout = 'https://pay.example.com/checkout';

describe('extractTrafficSource - manual reminders', () => {
  it('classifica lembretes manuais sem pista paga como organic.email', () => {
    const checkoutUrl =
      `${baseCheckout}?rb_manual=email&utm_source=manual-email&utm_medium=email&utm_campaign=manual-reminder`;

    const result = extractTrafficSource({}, checkoutUrl, null);

    expect(result).toBe('organic.email');
  });

  it('mantém o canal pago ao adicionar o sufixo .email', () => {
    const checkoutUrl =
      `${baseCheckout}?rb_manual=email&utm_source=tiktok&utm_medium=paid&utm_campaign=manual-reminder`;

    const result = extractTrafficSource({}, checkoutUrl, 'tiktok.paid');

    expect(result).toBe('tiktok.paid.email');
  });

  it('adiciona o marcador pago quando o histórico só contém o canal', () => {
    const checkoutUrl =
      `${baseCheckout}?rb_manual=email&utm_source=tiktok&utm_medium=paid&utm_campaign=manual-reminder`;

    const result = extractTrafficSource({}, checkoutUrl, 'tiktok');

    expect(result).toBe('tiktok.paid.email');
  });

  it('padroniza lembretes orgânicos preservando o canal existente', () => {
    const checkoutUrl =
      `${baseCheckout}?rb_manual=email&utm_source=manual-email&utm_medium=email&utm_campaign=manual-reminder`;

    const result = extractTrafficSource({}, checkoutUrl, 'tiktok');

    expect(result).toBe('tiktok.organic.email');
  });

  it('mantém o canal orgânico quando o manual vem de um tiktok orgânico', () => {
    const checkoutUrl =
      `${baseCheckout}?rb_manual=email&utm_source=manual-email&utm_medium=email&utm_campaign=manual-reminder`;

    const result = extractTrafficSource({}, checkoutUrl, 'tiktok.organic');

    expect(result).toBe('tiktok.organic.email');
  });
});
