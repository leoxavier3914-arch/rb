export interface ApiFetchOptions extends RequestInit {
  headers?: HeadersInit;
}

export async function apiFetch(input: RequestInfo | URL, init: ApiFetchOptions = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-admin-role", "true");

  return fetch(input, {
    ...init,
    headers,
  });
}

export async function apiFetchJson<T>(input: RequestInfo | URL, init: ApiFetchOptions = {}) {
  const response = await apiFetch(input, init);
  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message);
  }
  return (await response.json()) as T;
}

async function extractErrorMessage(response: Response) {
  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
        return payload.message;
      }
    }
    const text = await response.text();
    if (text) {
      return text;
    }
  } catch (error) {
    console.warn("Falha ao extrair mensagem de erro da resposta", error);
  }
  return "Falha na requisição";
}
