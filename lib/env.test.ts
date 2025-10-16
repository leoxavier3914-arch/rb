import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetEnvForTesting, getSupabaseEnv, supabaseEnv } from "./env";

const setBaseEnv = () => {
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
};

describe("supabase env validation", () => {
  beforeEach(() => {
    __resetEnvForTesting();
    setBaseEnv();
  });

  it("normaliza espaços e aspas antes de validar", () => {
    process.env.SUPABASE_URL = '  "https://project.supabase.co"  ';
    process.env.SUPABASE_SERVICE_ROLE_KEY = "  service-role  ";
    process.env.NEXT_PUBLIC_SUPABASE_URL = " https://project.supabase.co ";

    const env = getSupabaseEnv();

    expect(env.SUPABASE_URL).toBe("https://project.supabase.co");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://project.supabase.co");
  });

  it("falha quando a URL pública aponta para outro projeto", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://outro.supabase.co";

    try {
      expect(supabaseEnv.has()).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        "Variáveis de ambiente incompletas",
        expect.objectContaining({
          NEXT_PUBLIC_SUPABASE_URL: expect.arrayContaining([
            "NEXT_PUBLIC_SUPABASE_URL deve apontar para o mesmo projeto do SUPABASE_URL.",
          ]),
        }),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("falha quando SUPABASE_URL não usa https", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.SUPABASE_URL = "http://project.supabase.co";

    try {
      expect(supabaseEnv.has()).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        "Variáveis de ambiente incompletas",
        expect.objectContaining({
          SUPABASE_URL: expect.arrayContaining([
            "A URL do Supabase deve usar o protocolo https://.",
          ]),
        }),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});

