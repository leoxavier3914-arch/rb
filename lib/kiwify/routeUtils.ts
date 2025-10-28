import { NextResponse } from 'next/server';
import { KiwifyHttpError } from './http';

export function buildKiwifyErrorResponse(error: unknown, fallback: string, code: string): NextResponse {
  if (error instanceof KiwifyHttpError) {
    let parsed: unknown = null;
    let message = fallback;

    if (!error.isHtml && error.bodyText) {
      try {
        parsed = JSON.parse(error.bodyText);
        if (parsed && typeof parsed === 'object') {
          const candidate =
            typeof (parsed as Record<string, unknown>).message === 'string'
              ? (parsed as Record<string, string>).message
              : typeof (parsed as Record<string, unknown>).error === 'string'
                ? (parsed as Record<string, string>).error
                : null;
          if (candidate && candidate.trim() !== '') {
            message = candidate;
          }
        }
      } catch {
        parsed = error.bodyText;
        if (typeof parsed === 'string' && parsed.trim() !== '') {
          message = parsed.trim().slice(0, 200);
        }
      }
    }

    const body: Record<string, unknown> = { ok: false, code, error: message };
    if (parsed !== null) {
      body.details = parsed;
    }

    return NextResponse.json(body, { status: error.status });
  }

  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ ok: false, code, error: message }, { status: 500 });
}
