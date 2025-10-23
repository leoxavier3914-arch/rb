import type { KiwifyAccessTokenMetadata } from "@/lib/kiwify/client";

export interface TokenActionState {
  ok: boolean;
  message: string;
  metadata?: KiwifyAccessTokenMetadata;
}

export const tokenActionInitialState: TokenActionState = {
  ok: false,
  message: "",
};
