"use server";

import { hasKiwifyApiEnv } from "@/lib/env";
import { getAccessTokenMetadata, invalidateCachedToken } from "@/lib/kiwify/client";

export interface TokenActionState {
  ok: boolean;
  message: string;
  metadata?: Awaited<ReturnType<typeof getAccessTokenMetadata>>;
}

export const tokenActionInitialState: TokenActionState = {
  ok: false,
  message: "",
};

export async function refreshTokenAction(
  _prevState: TokenActionState,
  _formData: FormData,
): Promise<TokenActionState> {
  if (!hasKiwifyApiEnv()) {
    return {
      ok: false,
      message: "Configure as variáveis de ambiente para solicitar um token.",
    };
  }

  try {
    await invalidateCachedToken();
    const metadata = await getAccessTokenMetadata(true);

    return {
      ok: true,
      message: "Token renovado com sucesso.",
      metadata,
    };
  } catch (error) {
    console.error("Erro ao renovar token da Kiwify", error);
    return {
      ok: false,
      message: "Falha ao renovar o token junto à Kiwify.",
    };
  }
}
