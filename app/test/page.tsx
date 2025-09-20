'use client';

import { useState } from 'react';

export default function TestPage() {
  const [email, setEmail] = useState('leocesar3914@gmail.com');
  const [name, setName] = useState('Cliente Teste');
  const [product, setProduct] = useState('Catálogo Editável - Cílios');
  const [checkoutUrl, setCheckoutUrl] = useState('https://pay.kiwify.com.br/SEU_LINK');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!email.trim()) {
      setMsg('Informe um e-mail válido.');
      return;
    }

    try {
      setLoading(true);

      // Token admin salvo no login (se houver)
      const token =
        localStorage.getItem('rb_admin_token') ||
        localStorage.getItem('ADMIN_TOKEN') ||
        '';

      const res = await fetch('/api/admin/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email,                 // ✅ chave correta
          name,
          product_title: product,
          checkout_url: checkoutUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg(`Erro: ${data?.error?.message || data?.error || 'Não foi possível registrar o teste.'}`);
        return;
      }

      setMsg(`OK! Agendado para ${new Date(data.schedule_at).toLocaleString()}`);
    } catch (err) {
      console.error(err);
      setMsg('Erro inesperado ao enviar o teste.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">Teste de Envio (Abandono)</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm opacity-80 mb-1">Seu e-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md bg-slate-800/40 px-3 py-2 outline-none"
            placeholder="voce@exemplo.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm opacity-80 mb-1">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md bg-slate-800/40 px-3 py-2 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm opacity-80 mb-1">Produto</label>
          <input
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="w-full rounded-md bg-slate-800/40 px-3 py-2 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm opacity-80 mb-1">Checkout URL</label>
          <input
            value={checkoutUrl}
            onChange={(e) => setCheckoutUrl(e.target.value)}
            className="w-full rounded-md bg-slate-800/40 px-3 py-2 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-indigo-600 hover:bg-indigo-500 py-2 font-medium"
        >
          {loading ? 'Enviando…' : 'Enviar teste'}
        </button>

        {msg && <p className="text-sm opacity-80">{msg}</p>}
      </form>
    </div>
  );
}
