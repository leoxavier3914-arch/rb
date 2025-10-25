import { kiwifyFetch } from './http';
import { chunk, upsertProductsBatch, upsertSalesBatch } from './writes';

export type SyncCursor = {
  resource?: 'products' | 'sales';
  page?: number;
  intervalIndex?: number;
  done?: boolean;
};

export type SyncRequest = {
  full?: boolean;
  range?: { startDate: string; endDate: string } | null;
  cursor?: SyncCursor | null;
  now?: string;
};

export type SyncResult = {
  ok: boolean;
  done: boolean;
  nextCursor: SyncCursor | null;
  stats: Record<string, number>;
  logs?: Array<{ url: string; page: number; status: number; elapsedMs: number }>;
};

const getBudget = () => Number(process.env.SYNC_BUDGET_MS) || 20000;
const pageSize = () => Number(process.env.KFY_PAGE_SIZE) || 100;
const batchSize = () => Number(process.env.DB_UPSERT_BATCH) || 500;

const makeBudget = (ms: number) => {
  const start = Date.now();
  return {
    left: () => Math.max(0, ms - (Date.now() - start)),
    over: () => Date.now() - start > ms,
  };
};

function buildIntervals(nowISO: string) {
  const now = new Date(nowISO);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(todayStart.getDate() + 1);

  const past = new Date(now);
  past.setDate(now.getDate() - 90);
  past.setHours(0, 0, 0, 0);

  return [
    { startDate: past.toISOString().slice(0, 10), endDate: now.toISOString().slice(0, 10) },
    { startDate: todayStart.toISOString().slice(0, 10), endDate: tomorrow.toISOString().slice(0, 10) },
  ];
}

async function parseJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Resposta inválida da Kiwify (${res.status}): ${text}`);
  }
}

export async function runSync(req: SyncRequest, budgetMs = getBudget()): Promise<SyncResult> {
  const budget = makeBudget(budgetMs);
  const stats: Record<string, number> = {
    pagesFetched: 0,
    productsUpserted: 0,
    salesUpserted: 0,
    batches: 0,
  };
  const logs: SyncResult['logs'] = [];
  let cursor: SyncCursor = req.cursor ?? { resource: 'products', page: 1, intervalIndex: 0, done: false };

  const nowISO = req.now ?? new Date().toISOString();
  const intervals = req.range ? [req.range] : buildIntervals(nowISO);

  while (!budget.over()) {
    if (cursor.resource === 'products') {
      const page = cursor.page ?? 1;
      const url = `/v1/products?page_number=${page}&page_size=${pageSize()}`;
      const startedAt = Date.now();
      const res = await kiwifyFetch(url, { method: 'GET' }, 1, budget);
      const elapsedMs = Date.now() - startedAt;
      if (!res.ok) {
        throw new Error(`Falha ao consultar produtos: ${res.status}`);
      }
      const body = await parseJson(res);
      const items: any[] = body?.data ?? body?.items ?? [];
      logs.push({ url, page, status: res.status, elapsedMs });
      stats.pagesFetched += 1;

      if (items.length) {
        for (const part of chunk(items, batchSize())) {
          stats.productsUpserted += await upsertProductsBatch(part);
          stats.batches += 1;
          if (budget.over()) break;
        }
        if (budget.over()) break;
        cursor.page = page + 1;
      } else {
        cursor = { resource: 'sales', page: 1, intervalIndex: 0, done: false };
      }
    } else if (cursor.resource === 'sales') {
      const interval = intervals[cursor.intervalIndex ?? 0];
      if (!interval) {
        cursor.done = true;
        break;
      }

      const page = cursor.page ?? 1;
      const url = `/v1/sales?page_number=${page}&page_size=${pageSize()}&start_date=${interval.startDate}&end_date=${interval.endDate}`;
      const startedAt = Date.now();
      const res = await kiwifyFetch(url, { method: 'GET' }, 1, budget);
      const elapsedMs = Date.now() - startedAt;
      if (!res.ok) {
        throw new Error(`Falha ao consultar vendas: ${res.status}`);
      }
      const body = await parseJson(res);
      const items: any[] = body?.data ?? body?.items ?? body?.sales ?? [];
      logs.push({ url, page, status: res.status, elapsedMs });
      stats.pagesFetched += 1;

      if (items.length) {
        for (const part of chunk(items, batchSize())) {
          stats.salesUpserted += await upsertSalesBatch(part);
          stats.batches += 1;
          if (budget.over()) break;
        }
        if (budget.over()) break;
        cursor.page = page + 1;
      } else {
        cursor.intervalIndex = (cursor.intervalIndex ?? 0) + 1;
        cursor.page = 1;
        if (!intervals[cursor.intervalIndex ?? 0]) {
          cursor.done = true;
          break;
        }
      }
    } else {
      cursor = { resource: 'products', page: 1, intervalIndex: 0, done: false };
    }
  }

  const done = Boolean(cursor.done);
  return {
    ok: true,
    done,
    nextCursor: done ? null : cursor,
    stats,
    logs,
  };
}

