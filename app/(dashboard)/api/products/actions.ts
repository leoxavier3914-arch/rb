"use server";

import { revalidatePath } from "next/cache";

import { hasKiwifyApiEnv } from "@/lib/env";
import { KiwifyApiError } from "@/lib/kiwify/client";
import { createProduct, updateProduct } from "@/lib/kiwify/resources";

export interface ProductActionState {
  ok: boolean;
  message: string;
  payload?: unknown;
}

export const productActionInitialState: ProductActionState = {
  ok: false,
  message: "",
};

function parseJsonPayload(raw: FormDataEntryValue | null) {
  if (!raw || typeof raw !== "string") {
    return { error: "Informe um JSON válido no payload." } as const;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return { error: "O payload precisa ser um objeto JSON." } as const;
    }

    return { value: parsed as Record<string, unknown> } as const;
  } catch (error) {
    return { error: "Não foi possível interpretar o JSON informado." } as const;
  }
}

export async function createProductAction(
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  if (!hasKiwifyApiEnv()) {
    return {
      ok: false,
      message: "Configure as variáveis de ambiente da API antes de criar produtos.",
    };
  }

  const parsed = parseJsonPayload(formData.get("payload"));

  if ("error" in parsed) {
    return { ok: false, message: parsed.error };
  }

  const resourcePath = formData.get("resourcePath");

  try {
    const response = resourcePath && typeof resourcePath === "string" && resourcePath.trim()
      ? await createProduct(parsed.value, resourcePath.trim())
      : await createProduct(parsed.value);

    revalidatePath("/api/products");

    return {
      ok: true,
      message: "Produto criado com sucesso.",
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

    console.error("Erro inesperado ao criar produto", error);
    return {
      ok: false,
      message: "Erro inesperado ao criar o produto na Kiwify.",
    };
  }
}

export async function updateProductAction(
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  if (!hasKiwifyApiEnv()) {
    return {
      ok: false,
      message: "Configure as variáveis de ambiente da API antes de atualizar produtos.",
    };
  }

  const productId = formData.get("productId");

  if (!productId || typeof productId !== "string" || !productId.trim()) {
    return { ok: false, message: "Informe o ID do produto que deseja atualizar." };
  }

  const parsed = parseJsonPayload(formData.get("payload"));

  if ("error" in parsed) {
    return { ok: false, message: parsed.error };
  }

  const resourcePath = formData.get("resourcePath");

  try {
    const response = resourcePath && typeof resourcePath === "string" && resourcePath.trim()
      ? await updateProduct(productId.trim(), parsed.value, { path: resourcePath.trim() })
      : await updateProduct(productId.trim(), parsed.value);

    revalidatePath("/api/products");

    return {
      ok: true,
      message: "Produto atualizado com sucesso.",
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

    console.error("Erro inesperado ao atualizar produto", error);
    return {
      ok: false,
      message: "Erro inesperado ao atualizar o produto na Kiwify.",
    };
  }
}
