import { NextRequest, NextResponse } from "next/server";

import { assertIsAdmin } from "@/lib/auth";
import { getAccessToken, getAccessTokenMetadata } from "@/lib/kiwify/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  assertIsAdmin(request);
  let metadata = await getAccessTokenMetadata();

  if (!metadata.hasToken) {
    await getAccessToken();
    metadata = await getAccessTokenMetadata();
  }

  return NextResponse.json({
    authenticated: metadata.hasToken,
    expiresAt: metadata.expiresAt,
  });
}

export async function POST(request: NextRequest) {
  assertIsAdmin(request);
  await getAccessToken(true);
  const metadata = await getAccessTokenMetadata();
  return NextResponse.json({
    ok: true,
    expiresAt: metadata.expiresAt,
  });
}
