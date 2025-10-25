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

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ?.split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (!allowedOrigins?.length) {
    if (process.env.NODE_ENV === "development") {
      return;
    }
    throw new Response("Origem não configurada", { status: 403 });
  }

  const parsed = originSchema.safeParse(origin);
  if (!parsed.success) {
    throw new Response("Origem inválida", { status: 403 });
  }

  const normalizedAllowedOrigins = allowedOrigins.reduce<string[]>((acc, value) => {
    try {
      acc.push(new URL(value).origin);
    } catch (error) {
      console.warn("Origem inválida em ALLOWED_ORIGINS", value, error);
    }
    return acc;
  }, []);

  if (!normalizedAllowedOrigins.length) {
    if (process.env.NODE_ENV === "development") {
      return;
    }
    throw new Response("Nenhuma origem permitida válida configurada", { status: 403 });
  }

  const isAllowed = normalizedAllowedOrigins.includes(parsed.data.origin);
  if (!isAllowed) {
    throw new Response("Origem não permitida", { status: 403 });
  }
}
