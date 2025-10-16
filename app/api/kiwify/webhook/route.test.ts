import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fakeDatabase, createClientMock, createClientFactory } = vi.hoisted(() => {
  type FakeDatabase = { rows: any[]; updates: any[] };

  class FakeSelectBuilder {
    private filters: Array<(row: any) => boolean> = [];
    private orderColumn: string | null = null;
    private orderAscending = true;
    private limitValue: number | null = null;

    constructor(private readonly getRows: () => any[]) {}

    eq(column: string, value: any) {
      this.filters.push((row) => row?.[column] === value);
      return this;
    }

    neq(column: string, value: any) {
      this.filters.push((row) => row?.[column] !== value);
      return this;
    }

    in(column: string, values: any[]) {
      const normalizedValues = values
        .map((value) => {
          if (value === null || value === undefined) return null;
          if (typeof value === 'string') return value;
          if (typeof value === 'number' && Number.isFinite(value)) return String(value);
          return null;
        })
        .filter((value): value is string => Boolean(value));
      const set = new Set(normalizedValues);
      this.filters.push((row) => {
        const current = row?.[column];
        if (current === null || current === undefined) return false;
        const normalized = typeof current === 'string' ? current : String(current);
        return set.has(normalized);
      });
      return this;
    }

    order(column: string, options?: { ascending?: boolean }) {
      this.orderColumn = column;
      this.orderAscending = options?.ascending ?? true;
      return this;
    }

    limit(value: number) {
      this.limitValue = typeof value === 'number' ? value : null;
      return this;
    }

    maybeSingle() {
      const results = this.execute();
      return Promise.resolve({ data: results[0] ?? null, error: null });
    }

    then<TResult1 = { data: any[]; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: any[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      const result = { data: this.execute(), error: null as null };
      return Promise.resolve(result).then(onfulfilled, onrejected);
    }

    private execute() {
      let rows = this.getRows().map((row) => ({ ...row }));
      for (const filter of this.filters) {
        rows = rows.filter((row) => filter(row));
      }
      if (this.orderColumn) {
        const column = this.orderColumn;
        const ascending = this.orderAscending;
        rows.sort((a, b) => {
          const av = a?.[column];
          const bv = b?.[column];
          if (av === bv) return 0;
          if (av === undefined || av === null) return ascending ? -1 : 1;
          if (bv === undefined || bv === null) return ascending ? 1 : -1;

          const aTime = typeof av === 'string' ? Date.parse(av) : Number.NaN;
          const bTime = typeof bv === 'string' ? Date.parse(bv) : Number.NaN;
          const bothDates = !Number.isNaN(aTime) && !Number.isNaN(bTime);
          if (bothDates) {
            return ascending ? aTime - bTime : bTime - aTime;
          }

          const aStr = typeof av === 'string' ? av : String(av);
          const bStr = typeof bv === 'string' ? bv : String(bv);
          if (aStr === bStr) return 0;
          if (ascending) return aStr > bStr ? 1 : -1;
          return aStr > bStr ? -1 : 1;
        });
      }
      if (typeof this.limitValue === 'number') {
        rows = rows.slice(0, this.limitValue);
      }
      return rows;
    }
  }

  class FakeSupabaseTable {
    constructor(
      private readonly db: FakeDatabase,
      private readonly table: 'abandoned_emails' | 'abandoned_email_updates',
    ) {}

    private getStore() {
      return this.table === 'abandoned_emails' ? this.db.rows : this.db.updates;
    }

    select(_columns: string) {
      return new FakeSelectBuilder(() => this.getStore());
    }

    upsert(row: any, options?: { onConflict?: string }) {
      const normalized = { ...row };
      const onConflict = options?.onConflict;
      if (this.table === 'abandoned_email_updates') {
        return this.insert(normalized);
      }
      if (onConflict === 'checkout_id' && normalized.checkout_id) {
        const index = this.db.rows.findIndex(
          (existing) => existing.checkout_id === normalized.checkout_id
        );
        if (index >= 0) {
          this.db.rows[index] = { ...this.db.rows[index], ...normalized };
          return Promise.resolve({ data: this.db.rows[index], error: null });
        }
      }
      this.db.rows.push({ ...normalized });
      return Promise.resolve({ data: normalized, error: null });
    }

    update(values: Record<string, any>) {
      return {
        eq: async (column: string, value: any) => {
          const updated: any[] = [];
          const store = this.getStore();
          const nextStore = store.map((row) => {
            if (row?.[column] === value) {
              const next = { ...row, ...values };
              updated.push(next);
              return next;
            }
            return row;
          });
          if (this.table === 'abandoned_emails') {
            this.db.rows = nextStore;
          } else {
            this.db.updates = nextStore;
          }
          return { data: updated, error: null };
        },
      };
    }

    insert(value: any) {
      const rows = Array.isArray(value) ? value : [value];
      const store = this.getStore();
      const inserted = rows.map((row) => ({ ...row }));
      store.push(...inserted);
      return Promise.resolve({ data: inserted, error: null });
    }
  }

  class FakeSupabaseClient {
    constructor(private readonly db: FakeDatabase) {}

    from(table: string) {
      if (table === 'abandoned_emails' || table === 'abandoned_email_updates') {
        return new FakeSupabaseTable(this.db, table);
      }
      throw new Error(`Unsupported table: ${table}`);
    }
  }

  const fakeDatabase: FakeDatabase = { rows: [], updates: [] };
  const createClientFactory = () => new FakeSupabaseClient(fakeDatabase);
  const createClientMock = vi.fn(createClientFactory);

  return { fakeDatabase, createClientMock, createClientFactory };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('next/cache', () => ({
  unstable_noStore: () => {},
}));

import { POST } from './route';
import { extractTrafficSource } from './traffic';
import { fetchAbandonedCarts } from '../../../../lib/abandonedCarts';

beforeEach(() => {
  fakeDatabase.rows.length = 0;
  fakeDatabase.updates.length = 0;
  createClientMock.mockClear();
  createClientMock.mockImplementation(createClientFactory);
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () => `uuid-${fakeDatabase.rows.length + fakeDatabase.updates.length + 1}`
  );
});

afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  vi.restoreAllMocks();
});

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

describe('POST handler - product separation', () => {
  it('cria um novo registro quando o produto muda para o mesmo e-mail', async () => {
    const payloadA = {
      email: 'cliente@example.com',
      product_id: 'prod-1',
      product_title: 'Curso Avançado',
      checkout_url: 'https://pay.kiwify.com.br/prod-1',
      status: 'pending',
    };

    const requestA = new Request('https://example.com/api/kiwify/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payloadA),
    });

    const responseA = await POST(requestA);
    expect(responseA.status).toBe(200);
    expect(await responseA.json()).toEqual({ ok: true });
    expect(fakeDatabase.rows).toHaveLength(1);
    expect(fakeDatabase.rows[0].product_id).toBe('prod-1');
    expect(fakeDatabase.rows[0].product_title).toBe('Curso Avançado');

    const payloadB = {
      email: 'cliente@example.com',
      product_id: 'prod-2',
      product_title: 'Curso Essencial',
      checkout_url: 'https://pay.kiwify.com.br/prod-2',
      status: 'pending',
    };

    const requestB = new Request('https://example.com/api/kiwify/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payloadB),
    });

    const responseB = await POST(requestB);
    expect(responseB.status).toBe(200);
    expect(await responseB.json()).toEqual({ ok: true });

    expect(fakeDatabase.rows).toHaveLength(2);
    const productIds = new Set(fakeDatabase.rows.map((row) => row.product_id));
    expect(productIds.has('prod-1')).toBe(true);
    expect(productIds.has('prod-2')).toBe(true);

    const productTitles = new Set(fakeDatabase.rows.map((row) => row.product_title));
    expect(productTitles.has('Curso Avançado')).toBe(true);
    expect(productTitles.has('Curso Essencial')).toBe(true);

    const checkoutIds = new Set(fakeDatabase.rows.map((row) => row.checkout_id));
    expect(checkoutIds.size).toBe(2);

    expect(fakeDatabase.updates).toHaveLength(2);
    const historyCheckoutIds = new Set(fakeDatabase.updates.map((row) => row.checkout_id));
    expect(historyCheckoutIds.has(fakeDatabase.rows[0].checkout_id)).toBe(true);
    expect(historyCheckoutIds.has(fakeDatabase.rows[1].checkout_id)).toBe(true);
  });
});

describe('POST handler - checkout renewal', () => {
  it('reabre o carrinho quando o checkout muda', async () => {
    vi.useFakeTimers();
    try {
      const baseNow = new Date('2024-07-01T12:00:00.000Z');
      vi.setSystemTime(baseNow);

      const existingRow = {
        id: 'cart-1',
        email: 'cliente@example.com',
        customer_email: 'cliente@example.com',
        customer_name: 'Cliente',
        checkout_id: 'old-checkout',
        checkout_url: 'https://pay.example.com/old-checkout',
        product_id: 'prod-1',
        product_title: 'Curso Antigo',
        status: 'paused',
        schedule_at: '2024-06-20T10:00:00.000Z',
        last_event: 'previous_event',
        created_at: '2024-06-01T10:00:00.000Z',
        updated_at: '2024-06-10T10:00:00.000Z',
        paid: false,
        paid_at: null,
        payload: { old: true },
        discount_code: null,
        source: 'kiwify.webhook',
        traffic_source: 'unknown',
      };

      fakeDatabase.rows.push(existingRow);

      const payload = {
        email: 'cliente@example.com',
        checkout_id: 'new-checkout-123',
        checkout_url: 'https://pay.example.com/?checkout=new-checkout-123',
        status: 'pending',
      };

      const request = new Request('https://example.com/api/kiwify/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });

      expect(fakeDatabase.rows).toHaveLength(1);
      const updatedRow = fakeDatabase.rows[0];

      expect(updatedRow.id).toBe('cart-1');
      expect(updatedRow.checkout_id).toBe('new-checkout-123');
      expect(updatedRow.status).toBe('new');
      expect(updatedRow.checkout_url).toBe('https://pay.example.com/?checkout=new-checkout-123');
      expect(updatedRow.last_event).toBeNull();
      expect(updatedRow.updated_at).toBe(baseNow.toISOString());

      const expectedScheduleAt = new Date(baseNow.getTime() + 24 * 3600 * 1000).toISOString();
      expect(updatedRow.schedule_at).toBe(expectedScheduleAt);

      expect(fakeDatabase.updates).toHaveLength(1);
      expect(fakeDatabase.updates[0].checkout_id).toBe('new-checkout-123');
      expect(fakeDatabase.updates[0].status).toBe('new');
    } finally {
      vi.useRealTimers();
    }
  });

  it('restaura o status "new" quando um checkout abandonado recebe PIX pendente', async () => {
    vi.useFakeTimers();
    try {
      const baseNow = new Date('2024-08-10T09:30:00.000Z');
      vi.setSystemTime(baseNow);

      const existingRow = {
        id: 'cart-2',
        email: 'cliente@example.com',
        customer_email: 'cliente@example.com',
        customer_name: 'Cliente',
        checkout_id: 'pix-checkout-1',
        checkout_url: 'https://pay.example.com/?checkout=pix-checkout-1',
        product_id: 'prod-1',
        product_title: 'Curso Avançado',
        status: 'abandoned',
        schedule_at: '2024-08-01T10:00:00.000Z',
        last_event: 'pix.pending',
        created_at: '2024-07-20T10:00:00.000Z',
        updated_at: '2024-07-25T10:00:00.000Z',
        paid: false,
        paid_at: null,
        payload: { status: 'abandoned' },
        discount_code: null,
        source: 'kiwify.webhook',
        traffic_source: 'unknown',
      };

      fakeDatabase.rows.push(existingRow);

      const pixPendingPayload = {
        email: 'cliente@example.com',
        checkout_id: 'pix-checkout-1',
        checkout_url: 'https://pay.example.com/?checkout=pix-checkout-1',
        event: 'pix.pending',
        status: 'pending',
        payment_method: 'pix',
        payment_status: 'pending',
      };

      const request = new Request('https://example.com/api/kiwify/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(pixPendingPayload),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });

      expect(fakeDatabase.rows).toHaveLength(1);
      const updatedRow = fakeDatabase.rows[0];

      expect(updatedRow.id).toBe('cart-2');
      expect(updatedRow.checkout_id).toBe('pix-checkout-1');
      expect(updatedRow.status).toBe('new');
      expect(updatedRow.paid).toBe(false);
      expect(updatedRow.last_event).toBe('pix.pending');
      expect(updatedRow.updated_at).toBe(baseNow.toISOString());
      expect(updatedRow.schedule_at).toBe('2024-08-01T10:00:00.000Z');

      expect(fakeDatabase.updates).toHaveLength(1);
      expect(fakeDatabase.updates[0].checkout_id).toBe('pix-checkout-1');
      expect(fakeDatabase.updates[0].event).toBe('pix.pending');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('fetchAbandonedCarts - status resolution', () => {
  it('mantém carrinho como pendente quando status persistido é pending', async () => {
    const nowIso = new Date().toISOString();

    fakeDatabase.rows.push({
      id: 'cart-manual-email',
      email: 'cliente@example.com',
      customer_email: 'cliente@example.com',
      status: 'pending',
      last_event: null,
      created_at: nowIso,
      updated_at: nowIso,
      paid: false,
      source: 'kiwify.webhook',
      payload: {
        status: 'manual.email.sent',
      },
    });

    const carts = await fetchAbandonedCarts();

    expect(carts).toHaveLength(1);
    expect(carts[0].status).toBe('pending');
  });
});

describe('fetchAbandonedCarts - histórico completo', () => {
  it('mantém todas as versões do carrinho disponíveis no histórico por cliente', async () => {
    fakeDatabase.rows.push(
      {
        id: 'cart-1',
        checkout_id: 'checkout-1',
        customer_email: 'cliente@example.com',
        customer_name: 'Cliente Teste',
        status: 'approved',
        last_event: 'payment.approved',
        created_at: '2024-08-01T09:00:00.000Z',
        updated_at: '2024-08-01T11:00:00.000Z',
        paid: true,
        paid_at: '2024-08-01T10:30:00.000Z',
        source: 'kiwify.webhook',
        payload: {},
      },
      {
        id: 'cart-2',
        checkout_id: 'checkout-2',
        customer_email: 'cliente@example.com',
        customer_name: 'Cliente Teste',
        status: 'abandoned',
        last_event: 'checkout.abandoned',
        created_at: '2024-08-02T08:00:00.000Z',
        updated_at: '2024-08-02T08:30:00.000Z',
        paid: false,
        source: 'kiwify.webhook',
        payload: {},
      },
    );

    fakeDatabase.updates.push(
      {
        id: 'history-cart-1-new',
        abandoned_email_id: 'cart-1',
        checkout_id: 'checkout-1',
        status: 'new',
        source: 'kiwify.webhook',
        event: 'Checkout criado',
        occurred_at: '2024-08-01T09:00:00.000Z',
        snapshot: {
          id: 'cart-1',
          checkout_id: 'checkout-1',
          customer_email: 'cliente@example.com',
          customer_name: 'Cliente Teste',
          status: 'new',
          last_event: 'Checkout criado',
          created_at: '2024-08-01T09:00:00.000Z',
          updated_at: '2024-08-01T09:00:00.000Z',
          paid: false,
          payload: {},
          source: 'kiwify.webhook',
        },
      },
      {
        id: 'history-cart-1-approved',
        abandoned_email_id: 'cart-1',
        checkout_id: 'checkout-1',
        status: 'approved',
        source: 'kiwify.webhook',
        event: 'Pagamento aprovado',
        occurred_at: '2024-08-01T11:00:00.000Z',
        snapshot: {
          id: 'cart-1',
          checkout_id: 'checkout-1',
          customer_email: 'cliente@example.com',
          customer_name: 'Cliente Teste',
          status: 'approved',
          last_event: 'Pagamento aprovado',
          created_at: '2024-08-01T09:00:00.000Z',
          updated_at: '2024-08-01T11:00:00.000Z',
          paid: true,
          paid_at: '2024-08-01T10:30:00.000Z',
          payload: {},
          source: 'kiwify.webhook',
        },
      },
      {
        id: 'history-cart-1-abandoned',
        abandoned_email_id: 'cart-1',
        checkout_id: 'checkout-1',
        status: 'abandoned',
        source: 'kiwify.webhook',
        event: 'Checkout abandonado',
        occurred_at: '2024-08-01T10:00:00.000Z',
        snapshot: {
          id: 'cart-1',
          checkout_id: 'checkout-1',
          customer_email: 'cliente@example.com',
          customer_name: 'Cliente Teste',
          status: 'abandoned',
          last_event: 'Checkout abandonado',
          created_at: '2024-08-01T09:00:00.000Z',
          updated_at: '2024-08-01T10:00:00.000Z',
          paid: false,
          payload: {},
          source: 'kiwify.webhook',
        },
      },
      {
        id: 'history-cart-2-new',
        abandoned_email_id: 'cart-2',
        checkout_id: 'checkout-2',
        status: 'new',
        source: 'kiwify.webhook',
        event: 'Checkout criado',
        occurred_at: '2024-08-02T08:00:00.000Z',
        snapshot: {
          id: 'cart-2',
          checkout_id: 'checkout-2',
          customer_email: 'cliente@example.com',
          customer_name: 'Cliente Teste',
          status: 'new',
          last_event: 'Checkout criado',
          created_at: '2024-08-02T08:00:00.000Z',
          updated_at: '2024-08-02T08:00:00.000Z',
          paid: false,
          payload: {},
          source: 'kiwify.webhook',
        },
      },
      {
        id: 'history-cart-2-abandoned',
        abandoned_email_id: 'cart-2',
        checkout_id: 'checkout-2',
        status: 'abandoned',
        source: 'kiwify.webhook',
        event: 'Checkout abandonado',
        occurred_at: '2024-08-02T08:30:00.000Z',
        snapshot: {
          id: 'cart-2',
          checkout_id: 'checkout-2',
          customer_email: 'cliente@example.com',
          customer_name: 'Cliente Teste',
          status: 'abandoned',
          last_event: 'Checkout abandonado',
          created_at: '2024-08-02T08:00:00.000Z',
          updated_at: '2024-08-02T08:30:00.000Z',
          paid: false,
          payload: {},
          source: 'kiwify.webhook',
        },
      },
    );

    const carts = await fetchAbandonedCarts();

    expect(carts).toHaveLength(2);

    const firstCart = carts.find((cart) => cart.cart_key === 'checkout:checkout-1');
    expect(firstCart?.updates).toHaveLength(3);
    expect(
      firstCart?.updates.map((update) => ({
        status: update.status,
        lastEvent: update.snapshot.last_event,
      })),
    ).toEqual([
      { status: 'new', lastEvent: 'Checkout criado' },
      { status: 'abandoned', lastEvent: 'Checkout abandonado' },
      { status: 'approved', lastEvent: 'Pagamento aprovado' },
    ]);
    expect(firstCart?.history).toHaveLength(2);
    expect(firstCart?.history.map((entry) => entry.cartKey)).toEqual([
      'checkout:checkout-2',
      'checkout:checkout-1',
    ]);

    const secondCart = carts.find((cart) => cart.cart_key === 'checkout:checkout-2');
    expect(secondCart?.history).toHaveLength(2);

    const relatedFromSecond = secondCart?.history.find((entry) => entry.cartKey === 'checkout:checkout-1');
    expect(relatedFromSecond?.updates).toHaveLength(3);
  });

  it('aplica limite configurado ao consultar o histórico', async () => {
    fakeDatabase.rows.push(
      {
        id: 'cart-1',
        checkout_id: 'checkout-1',
        customer_email: 'cliente@example.com',
        status: 'new',
        created_at: '2024-08-01T09:00:00.000Z',
        updated_at: '2024-08-01T09:00:00.000Z',
        paid: false,
        source: 'kiwify.webhook',
        payload: {},
      },
      {
        id: 'cart-2',
        checkout_id: 'checkout-2',
        customer_email: 'cliente@example.com',
        status: 'abandoned',
        created_at: '2024-08-02T09:00:00.000Z',
        updated_at: '2024-08-02T09:00:00.000Z',
        paid: false,
        source: 'kiwify.webhook',
        payload: {},
      },
      {
        id: 'cart-3',
        checkout_id: 'checkout-3',
        customer_email: 'cliente@example.com',
        status: 'approved',
        created_at: '2024-08-03T09:00:00.000Z',
        updated_at: '2024-08-03T09:00:00.000Z',
        paid: true,
        source: 'kiwify.webhook',
        payload: {},
      },
    );

    process.env.ABANDONED_CARTS_HISTORY_LIMIT = '2';

    try {
      const carts = await fetchAbandonedCarts();
      expect(carts.length).toBeLessThanOrEqual(2);
    } finally {
      delete process.env.ABANDONED_CARTS_HISTORY_LIMIT;
    }
  });
});
