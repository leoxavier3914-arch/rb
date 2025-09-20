"use client";
import { useState } from "react";

export default function TestForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("Cliente Teste");
  const [product, setProduct] = useState("Catálogo Editável - Cílios");
  const [checkoutUrl, setCheckoutUrl] = useState("https://pay.kiwify.com.br/SEU_LINK");
  const [status, setStatus] = useState<string | null>(null);

  function generateCheckoutId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Enviando...");

    const checkout_id = generateCheckoutId();
    try {
      const res = await fetch("/api/admin/test-send", {
        method: "POST",
        body: JSON.stringify({
          checkout_id,
          email,
          customer_email: email,
          name,
          product_name: product,
          checkout_url: checkoutUrl
        }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`OK: enviado (registro: ${data?.id ?? checkout_id})`);
      } else {
        setStatus(`Erro: ${data?.error || "desconhecido"}`);
      }
    } catch (err: any) {
      setStatus(`Erro de rede: ${err?.message || err}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-sm mb-1">Seu e-mail</label>
        <input
          required
          type="email"
          className="w-full rounded-lg border p-2"
          placeholder="voce@exemplo.com"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Nome</label>
        <input
          type="text"
          className="w-full rounded-lg border p-2"
          value={name}
          onChange={(e)=>setName(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Produto</label>
        <input
          type="text"
          className="w-full rounded-lg border p-2"
          value={product}
          onChange={(e)=>setProduct(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Checkout URL</label>
        <input
          type="url"
          className="w-full rounded-lg border p-2"
          value={checkoutUrl}
          onChange={(e)=>setCheckoutUrl(e.target.value)}
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-lg border px-3 py-2 font-medium"
      >
        Enviar teste
      </button>

      {status && <p className="text-sm text-neutral-700">{status}</p>}
    </form>
  );
}
