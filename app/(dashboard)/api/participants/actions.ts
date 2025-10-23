"use server";

import { revalidatePath } from "next/cache";

import { hasKiwifyApiEnv } from "@/lib/env";
import { KiwifyApiError } from "@/lib/kiwify/client";
import { listParticipants } from "@/lib/kiwify/resources";

export interface ParticipantsActionState {
  ok: boolean;
  message: string;
  payload?: unknown;
}

export const participantsActionInitialState: ParticipantsActionState = {
  ok: false,
  message: "",
};

export async function loadParticipantsAction(
  _prevState: ParticipantsActionState,
  formData: FormData,
): Promise<ParticipantsActionState> {
  if (!hasKiwifyApiEnv()) {
    return {
      ok: false,
      message: "Configure as credenciais da API antes de consultar participantes.",
    };
  }

  const productId = formData.get("productId");

  if (!productId || typeof productId !== "string" || !productId.trim()) {
    return { ok: false, message: "Informe o ID do produto ou oferta para listar participantes." };
  }

  const status = formData.get("status");
  const perPageRaw = formData.get("perPage");
  const path = formData.get("resourcePath");

  const perPage = perPageRaw && typeof perPageRaw === "string" ? Number(perPageRaw) : undefined;

  try {
    const response = await listParticipants({
      productId: productId.trim(),
      status: status && typeof status === "string" && status.trim() ? status.trim() : undefined,
      perPage: Number.isFinite(perPage) && perPage ? perPage : undefined,
      path: path && typeof path === "string" && path.trim() ? path.trim() : undefined,
    });

    revalidatePath("/api/participants");

    return {
      ok: true,
      message: "Participantes carregados com sucesso.",
      payload: response,
    };
  } catch (error) {
    if (error instanceof KiwifyApiError) {
      return {
        ok: false,
        message: error.message,
        payload: error.details,
      };
    }

    console.error("Erro inesperado ao consultar participantes", error);
    return {
      ok: false,
      message: "Erro inesperado ao consultar participantes na Kiwify.",
    };
  }
}
