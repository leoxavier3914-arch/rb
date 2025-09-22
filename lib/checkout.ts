const COUPON_PARAMS = ['coupon', 'cupom', 'discount_code', 'discount'];

function normalize(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function applyDiscountToCheckoutUrl(
  checkoutUrl?: string | null,
  discountCode?: string | null,
): string {
  const url = normalize(checkoutUrl);
  const code = normalize(discountCode);

  if (!url) return '';
  if (!code) return url;

  try {
    const parsed = new URL(url);
    let applied = false;

    for (const param of COUPON_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, code);
        applied = true;
      }
    }

    if (!applied) {
      parsed.searchParams.set('coupon', code);
    }

    return parsed.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}coupon=${encodeURIComponent(code)}`;
  }
}
