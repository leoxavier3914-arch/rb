import { NextRequest } from "next/server";
import { z } from "zod";

const originSchema = z
  .string()
  .transform((value) => new URL(value))
  .refine((url) => url.protocol.startsWith("http"), {
    message: "Origem inválida",
  });

export function assertIsAdmin(request: NextRequest) {
  const adminHeader = request.headers.get("x-admin-role");
  if (adminHeader !== "true") {
    throw new Response("Usuário não autorizado", { status: 401 });
  }

  const origin = request.headers.get("origin");
  if (!origin) return;

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((value) => value.trim());
  if (!allowedOrigins?.length) return;

  const parsed = originSchema.safeParse(origin);
  if (!parsed.success) {
    throw new Response("Origem inválida", { status: 403 });
  }

  const isAllowed = allowedOrigins.some((allowed) => parsed.data.origin === new URL(allowed).origin);
  if (!isAllowed) {
    throw new Response("Origem não permitida", { status: 403 });
  }
}
