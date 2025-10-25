import { NextRequest, NextResponse } from 'next/server';

import { assertIsAdmin } from '@/lib/auth';
import { runSync, type SyncCursor } from '@/lib/kiwify/syncEngine';
import { getSyncCursor, setSyncCursor } from '@/lib/kiwify/syncState';

export const runtime = 'nodejs';
export const maxDuration = 300;

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const defaultRange = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const past = new Date(now);
  past.setDate(now.getDate() - 30);
  return { startDate: formatDate(past), endDate: formatDate(tomorrow) };
};

type ReconcileBody = {
  full?: boolean;
  range?: { startDate: string; endDate: string } | null;
  cursor?: SyncCursor | null;
  persist?: boolean;
};

export async function POST(request: NextRequest) {
  await assertIsAdmin(request);

  let body: ReconcileBody = {};
  try {
    body = (await request.json()) as ReconcileBody;
  } catch {
    body = {};
  }

  const persist = body.persist ?? false;
  let cursor = body.cursor ?? null;

  try {
    if (!cursor && persist) {
      const state = await getSyncCursor();
      cursor = state?.cursor ?? null;
    }
  } catch (error) {
    console.warn('Não foi possível carregar cursor persistido para reconcile', error);
  }

  const budget = Number(process.env.SYNC_BUDGET_MS) || 20000;

  try {
    const range = body.range ?? defaultRange();
    const result = await runSync({
      full: body.full,
      range,
      cursor,
    }, budget);

    if (persist) {
      try {
        await setSyncCursor(result.nextCursor ?? { done: true }, result.stats);
      } catch (error) {
        console.warn('Falha ao persistir cursor do reconcile', error);
      }
    }

    return NextResponse.json({
      ok: true,
      done: result.done,
      nextCursor: result.nextCursor,
      stats: result.stats,
      logs: result.logs ?? [],
    });
  } catch (error) {
    console.error('Erro ao executar reconcile', error);
    return NextResponse.json({ ok: false, error: 'reconcile_failed' }, { status: 500 });
  }
}

