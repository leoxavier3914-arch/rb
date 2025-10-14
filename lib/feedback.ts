import type { AbandonedCart, FeedbackEntry, Sale } from './types';

const STATUS_PRIORITY: Record<FeedbackEntry['status'], number> = {
  refunded: 3,
  converted: 2,
  sent: 1,
  pending: 0,
};

const getKeyFromContact = (email: string | null, phone: string | null) => {
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }

  const numericPhone = phone?.replace(/\D+/g, '');
  if (numericPhone) {
    return `phone:${numericPhone}`;
  }

  return null;
};

const mergeStrings = (current: string | null, incoming: string | null) => {
  if (incoming && incoming.trim()) {
    return incoming;
  }
  return current;
};

const pickLatestDate = (current: string | null, incoming: string | null) => {
  if (!incoming) {
    return current;
  }

  if (!current) {
    return incoming;
  }

  const currentTime = Date.parse(current);
  const incomingTime = Date.parse(incoming);

  if (Number.isNaN(incomingTime)) {
    return current;
  }
  if (Number.isNaN(currentTime)) {
    return incoming;
  }

  return incomingTime >= currentTime ? incoming : current;
};

const updateStatus = (current: FeedbackEntry['status'], incoming: FeedbackEntry['status']) => {
  const currentPriority = STATUS_PRIORITY[current];
  const incomingPriority = STATUS_PRIORITY[incoming];
  return incomingPriority > currentPriority ? incoming : current;
};

const toFeedbackEntryFromSale = (sale: Sale): FeedbackEntry | null => {
  const status = sale.status === 'refunded' ? 'refunded' : 'converted';
  const contactKey = getKeyFromContact(sale.customer_email, sale.customer_phone);

  if (!contactKey) {
    return null;
  }

  return {
    id: contactKey,
    customer_email: sale.customer_email,
    customer_name: sale.customer_name,
    customer_phone: sale.customer_phone ?? null,
    product_name: sale.product_name,
    status,
    paid_at: sale.paid_at,
    last_cart_activity: null,
    checkout_url: null,
    origin: 'sale',
  } satisfies FeedbackEntry;
};

const toFeedbackEntryFromCart = (cart: AbandonedCart): FeedbackEntry | null => {
  const contactKey = getKeyFromContact(cart.customer_email, cart.customer_phone);

  if (!contactKey) {
    return null;
  }

  const lastActivity = cart.updated_at ?? cart.created_at ?? null;
  const status = ((): FeedbackEntry['status'] => {
    if (cart.status === 'refunded') return 'refunded';
    if (cart.status === 'converted') return 'converted';
    if (cart.status === 'sent') return 'sent';
    return 'pending';
  })();

  return {
    id: contactKey,
    customer_email: cart.customer_email,
    customer_name: cart.customer_name,
    customer_phone: cart.customer_phone ?? null,
    product_name: cart.product_name,
    status,
    paid_at: cart.paid_at,
    last_cart_activity: lastActivity,
    checkout_url: cart.checkout_url ?? null,
    origin: 'cart',
  } satisfies FeedbackEntry;
};

export function buildFeedbackEntries(sales: Sale[], carts: AbandonedCart[]): FeedbackEntry[] {
  const entries = new Map<string, FeedbackEntry>();

  for (const sale of sales) {
    const entry = toFeedbackEntryFromSale(sale);
    if (!entry) {
      continue;
    }

    const existing = entries.get(entry.id);
    if (!existing) {
      entries.set(entry.id, entry);
      continue;
    }

    const merged: FeedbackEntry = {
      ...existing,
      customer_email: mergeStrings(existing.customer_email, entry.customer_email) ?? '',
      customer_name: mergeStrings(existing.customer_name, entry.customer_name),
      customer_phone: mergeStrings(existing.customer_phone, entry.customer_phone),
      product_name: mergeStrings(existing.product_name, entry.product_name),
      status: updateStatus(existing.status, entry.status),
      paid_at: pickLatestDate(existing.paid_at, entry.paid_at),
      origin: existing.origin === 'cart' ? 'mixed' : existing.origin,
    };

    entries.set(entry.id, merged);
  }

  for (const cart of carts) {
    const entry = toFeedbackEntryFromCart(cart);
    if (!entry) {
      continue;
    }

    const existing = entries.get(entry.id);
    if (!existing) {
      entries.set(entry.id, entry);
      continue;
    }

    const mergedStatus = updateStatus(existing.status, entry.status);

    const merged: FeedbackEntry = {
      ...existing,
      customer_email: mergeStrings(existing.customer_email, entry.customer_email) ?? '',
      customer_name: mergeStrings(existing.customer_name, entry.customer_name),
      customer_phone: mergeStrings(existing.customer_phone, entry.customer_phone),
      product_name: mergeStrings(existing.product_name, entry.product_name),
      status: mergedStatus,
      paid_at: pickLatestDate(existing.paid_at, entry.paid_at),
      last_cart_activity: pickLatestDate(existing.last_cart_activity, entry.last_cart_activity),
      checkout_url: mergeStrings(existing.checkout_url, entry.checkout_url),
      origin: existing.origin === 'sale' ? 'mixed' : existing.origin,
    };

    entries.set(entry.id, merged);
  }

  return Array.from(entries.values()).sort((a, b) => {
    const aDate = Math.max(
      a.paid_at ? Date.parse(a.paid_at) : Number.NEGATIVE_INFINITY,
      a.last_cart_activity ? Date.parse(a.last_cart_activity) : Number.NEGATIVE_INFINITY,
    );
    const bDate = Math.max(
      b.paid_at ? Date.parse(b.paid_at) : Number.NEGATIVE_INFINITY,
      b.last_cart_activity ? Date.parse(b.last_cart_activity) : Number.NEGATIVE_INFINITY,
    );

    return bDate - aDate;
  });
}
