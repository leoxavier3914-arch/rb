import { loadEnv } from '@/lib/env';

export type SyncResource =
  | 'products'
  | 'sales'
  | 'customers'
  | 'subscriptions'
  | 'enrollments'
  | 'coupons'
  | 'refunds'
  | 'payouts';

export interface SyncCursor {
  readonly resource: SyncResource;
  readonly page: number;
  readonly intervalIndex: number;
  readonly done: boolean;
}

export interface SyncRequest {
  readonly full?: boolean;
  readonly range?: {
    readonly startDate: string;
    readonly endDate: string;
  } | null;
  readonly cursor?: SyncCursor | null;
  readonly persist?: boolean;
}

export interface SyncResult {
  readonly ok: boolean;
  readonly done: boolean;
  readonly nextCursor: SyncCursor | null;
  readonly stats: Record<string, number>;
  readonly logs: readonly string[];
}

interface IntervalRange {
  readonly start: Date;
  readonly end: Date;
}

export function buildDefaultIntervals(): IntervalRange[] {
  const now = new Date();
  return [0, 30, 90].map((days) => ({
    start: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    end: now
  }));
}

export async function runSync(request: SyncRequest): Promise<SyncResult> {
  const env = loadEnv();
  const budget = env.SYNC_BUDGET_MS ?? 20_000;
  const budgetEndsAt = Date.now() + budget;
  const cursor = request.cursor ?? {
    resource: 'products',
    page: 1,
    intervalIndex: 0,
    done: false
  };

  const logs: string[] = [];
  logs.push(`Iniciando sync para ${cursor.resource} a partir da página ${cursor.page}`);

  if (Date.now() > budgetEndsAt - 1000) {
    return {
      ok: true,
      done: false,
      nextCursor: cursor,
      stats: {},
      logs: [...logs, 'Budget insuficiente para executar a sincronização.']
    };
  }

  // Nesta fase inicial a engine não executa chamadas externas, apenas devolve o cursor recebido.
  return {
    ok: true,
    done: false,
    nextCursor: {
      ...cursor,
      page: cursor.page + 1
    },
    stats: {},
    logs: [...logs, 'Simulação concluída; integração real será implementada nas próximas iterações.']
  };
}
