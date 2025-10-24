import { NextRequest, NextResponse } from "next/server";

import { assertIsAdmin } from "@/lib/auth";
import { getAccessToken, getAccessTokenMetadata } from "@/lib/kfyClient";

export async function GET(request: NextRequest) {
  assertIsAdmin(request);
  const metadata = getAccessTokenMetadata();
  return NextResponse.json({
    authenticated: metadata.hasToken,
    expiresAt: metadata.expiresAt,
  });
}

export async function POST(request: NextRequest) {
  assertIsAdmin(request);
  await getAccessToken();
  const metadata = getAccessTokenMetadata();
  return NextResponse.json({
    ok: true,
    expiresAt: metadata.expiresAt,
  });
}
