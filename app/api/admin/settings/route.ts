export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readEnvValue } from '../../../../lib/env';
import { getSettings, updateSettings } from '../../../../lib/settings';

type ErrorResponse = {
  ok: false;
  error: string;
  issues?: { path: string; message: string }[];
};

type SuccessResponse = {
  ok: true;
  settings: Awaited<ReturnType<typeof getSettings>>;
};

const payloadSchema = z
  .object({
    default_delay_hours: z.union([z.number().int().min(0).max(720), z.null()]).optional(),
    default_expire_hours: z.union([z.number().int().min(0).max(1440), z.null()]).optional(),
    kiwify_webhook_token: z.union([z.string().min(1), z.null()]).optional(),
    admin_token: z.union([z.string().min(6), z.null()]).optional(),
  })
  .refine((value) => {
    if (
      typeof value.default_delay_hours === 'number' &&
      typeof value.default_expire_hours === 'number'
    ) {
      return value.default_delay_hours <= value.default_expire_hours;
    }
    return true;
  }, {
    message: 'default_delay_hours não pode ser maior que default_expire_hours',
    path: ['default_delay_hours'],
  });

function normalizeRequestNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : NaN;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : NaN;
  }

  return NaN;
}

function normalizeRequestString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length === 0 ? null : normalized;
}

function preparePayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};

  if ('default_delay_hours' in body) {
    payload.default_delay_hours = normalizeRequestNumber(body.default_delay_hours);
  }

  if ('default_expire_hours' in body) {
    payload.default_expire_hours = normalizeRequestNumber(body.default_expire_hours);
  }

  if ('kiwify_webhook_token' in body) {
    payload.kiwify_webhook_token = normalizeRequestString(body.kiwify_webhook_token);
  }

  if ('admin_token' in body) {
    payload.admin_token = normalizeRequestString(body.admin_token);
  }

  return payload;
}

function buildErrorResponse(status: number, body: ErrorResponse) {
  return NextResponse.json(body, { status });
}

function ensureAuthorized(req: Request) {
  const adminToken = readEnvValue('ADMIN_TOKEN');

  if (!adminToken) {
    return { ok: true as const };
  }

  const header = req.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();

  if (!token || token !== adminToken) {
    return { ok: false as const };
  }

  return { ok: true as const };
}

export async function GET(req: Request) {
  const auth = ensureAuthorized(req);
  if (!auth.ok) {
    return buildErrorResponse(401, { ok: false, error: 'unauthorized' });
  }

  try {
    const settings = await getSettings();
    const response: SuccessResponse = { ok: true, settings };
    return NextResponse.json(response, {
      status: 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('[settings] GET error', error);
    return buildErrorResponse(500, { ok: false, error: 'settings_fetch_failed' });
  }
}

export async function PUT(req: Request) {
  const auth = ensureAuthorized(req);
  if (!auth.ok) {
    return buildErrorResponse(401, { ok: false, error: 'unauthorized' });
  }

  let json: any;
  try {
    json = await req.json();
  } catch (error) {
    console.error('[settings] invalid json', error);
    return buildErrorResponse(400, { ok: false, error: 'invalid_json' });
  }

  const prepared = preparePayload(typeof json === 'object' && json ? json : {});
  const result = payloadSchema.safeParse(prepared);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.') || 'root',
      message: issue.message,
    }));

    return buildErrorResponse(400, {
      ok: false,
      error: 'invalid_payload',
      issues,
    });
  }

  try {
    const settings = await updateSettings(result.data);
    const response: SuccessResponse = { ok: true, settings };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[settings] PUT error', error);
    return buildErrorResponse(500, { ok: false, error: 'settings_update_failed' });
  }
}
