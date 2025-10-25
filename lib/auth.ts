import { NextRequest } from "next/server";
import { z } from "zod";

const originSchema = z
  .string()
  .transform((value) => new URL(value))
  .refine((url) => url.protocol.startsWith("http"), {
    message: "Origem inválida",
  });

function normalizeAllowedOrigin(value: string) {
  let lastError: unknown;
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  for (const candidate of [trimmed, `https://${trimmed}`]) {
    try {
      return new URL(candidate).origin;
    } catch (error) {
      lastError = error;
    }
  }

  console.warn("Origem inválida em ALLOWED_ORIGENS", trimmed, lastError);
  return null;
}

export function assertIsAdmin(request: NextRequest) {
  const adminHeader = request.headers.get("x-admin-role");
  if (adminHeader !== "true") {
    throw new Response("Usuário não autorizado", { status: 401 });
  }

  const origin = request.headers.get("origin");
  if (!origin) return;

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ?.split(",")
    .map(normalizeAllowedOrigin)
    .filter((value): value is string => Boolean(value));

  if (!allowedOrigins?.length) {
    if (process.env.NODE_ENV === "production") {
      console.warn("ALLOWED_ORIGINS ausente ou inválido. Permitindo origem recebida.", { origin });
    }
    return;
  }

  const parsed = originSchema.safeParse(origin);
  if (!parsed.success) {
    throw new Response("Origem inválida", { status: 403 });
  }

  const isAllowed = allowedOrigins.includes(parsed.data.origin);
  if (!isAllowed) {
    throw new Response("Origem não permitida", { status: 403 });
  }
}
