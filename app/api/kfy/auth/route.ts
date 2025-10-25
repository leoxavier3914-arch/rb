import { NextRequest, NextResponse } from "next/server";

import { assertIsAdmin } from "@/lib/auth";
import { getAccessToken, getAccessTokenMetadata } from "@/lib/kiwify/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function ensureAdmin(request: NextRequest) {
  try {
    await assertIsAdmin(request);
    return null;
  } catch (error) {
    if (error instanceof Response) {
      const text = await error.text();
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(text || "{}") as Record<string, unknown>;
      } catch {
        payload = { error: text || "not_authorized" };
      }
      const body = JSON.stringify({ ok: false, ...payload });
      return new NextResponse(body, {
        status: error.status,
        headers: { "content-type": "application/json" },
      });
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const adminError = await ensureAdmin(request);
  if (adminError) {
    return adminError;
  }

  try {
    let metadata = await getAccessTokenMetadata();

    if (!metadata.hasToken) {
      await getAccessToken();
      metadata = await getAccessTokenMetadata();
    }

    return NextResponse.json({
      ok: true,
      summary: {
        authenticated: metadata.hasToken,
        expiresAt: metadata.expiresAt,
      },
    });
  } catch (error) {
    console.error("[kfy-auth] Falha ao consultar status", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const adminError = await ensureAdmin(request);
  if (adminError) {
    return adminError;
  }

  try {
    await getAccessToken(true);
    const metadata = await getAccessTokenMetadata();
    return NextResponse.json({
      ok: true,
      message: "Token renovado com sucesso.",
      summary: {
        expiresAt: metadata.expiresAt,
      },
    });
  } catch (error) {
    console.error("[kfy-auth] Falha ao renovar token", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", error: message },
      { status: 500 },
    );
  }
}
