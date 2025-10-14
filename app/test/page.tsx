'use client';

import { useEffect, useMemo, useState } from 'react';

type TemplateField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'url';
};

type TestTemplate = {
  id: string;
  name: string;
  description: string;
  templateId: string;
  fields: TemplateField[];
  defaults: Record<string, string>;
};

const TEST_TEMPLATES: TestTemplate[] = [
  {
    id: 'remarketing',
    name: 'E-mail de remarketing',
    description: 'Carrinhos abandonados, enviado automaticamente como hoje.',
    templateId:
      process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_REMARKETING_ID ??
      process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ??
      'template_remarketing',
    fields: [
      {
        key: 'name',
        label: 'Nome',
        placeholder: 'Cliente Teste',
      },
      {
        key: 'product_name',
        label: 'Produto',
        placeholder: 'Catálogo Editável - Cílios',
      },
      {
        key: 'checkout_url',
        label: 'Checkout URL',
        placeholder: 'https://pay.kiwify.com.br/SEU_LINK',
        type: 'url',
      },
    ],
    defaults: {
      name: 'Cliente Teste',
      product_name: 'Catálogo Editável - Cílios',
      checkout_url: 'https://pay.kiwify.com.br/SEU_LINK',
    },
  },
  {
    id: 'feedback',
    name: 'E-mail de feedback',
    description: 'Disparado para vendas aprovadas pedindo a avaliação do cliente.',
    templateId:
      process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_FEEDBACK_ID ??
      'template_feedback',
    fields: [
      {
        key: 'customer_name',
        label: 'Nome do cliente',
        placeholder: 'Cliente Teste',
      },
      {
        key: 'product_name',
        label: 'Produto',
        placeholder: 'Curso de Marketing Digital',
      },
      {
        key: 'purchase_date',
        label: 'Data da compra',
        placeholder: '2024-04-01T12:00:00Z',
      },
      {
        key: 'checkout_url',
        label: 'Checkout URL',
        placeholder: 'https://pay.kiwify.com.br/SEU_LINK',
        type: 'url',
      },
      {
        key: 'customer_phone',
        label: 'Telefone do cliente',
        placeholder: '+55 11 99999-9999',
      },
      {
        key: 'status',
        label: 'Status da compra',
        placeholder: 'completed',
      },
      {
        key: 'last_cart_activity',
        label: 'Última atividade do carrinho',
        placeholder: '2024-03-30T09:00:00Z',
      },
    ],
    defaults: {
      customer_name: 'Cliente Teste',
      product_name: 'Curso de Marketing Digital',
      purchase_date: '2024-04-01T12:00:00Z',
      checkout_url: 'https://pay.kiwify.com.br/SEU_LINK',
      customer_phone: '+55 11 99999-9999',
      status: 'completed',
      last_cart_activity: '2024-03-30T09:00:00Z',
    },
  },
];

export default function TestPage() {
  const [email, setEmail] = useState('leocesar3914@gmail.com');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(TEST_TEMPLATES[0]?.id ?? '');
  const [templateParams, setTemplateParams] = useState<Record<string, string>>(
    TEST_TEMPLATES[0]?.defaults ?? {},
  );
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => TEST_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId],
  );

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateParams((prev) => {
        const next: Record<string, string> = { ...selectedTemplate.defaults };
        for (const field of selectedTemplate.fields) {
          if (prev[field.key]) {
            next[field.key] = prev[field.key];
          }
        }
        return next;
      });
    }
  }, [selectedTemplate]);

  function generateCheckoutId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `manual-test-${Date.now()}`;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!email.trim()) {
      setMsg('Informe um e-mail válido.');
      return;
    }

    if (!selectedTemplate) {
      setMsg('Selecione um template para enviar.');
      return;
    }

    const checkoutUrl = templateParams.checkout_url ?? '';

    if (!checkoutUrl.trim()) {
      setMsg('Informe a URL do checkout.');
      return;
    }

    try {
      setLoading(true);

      const checkoutId = generateCheckoutId();
      const templateParamsPayload: Record<string, string> = {
        ...templateParams,
        to_email: email,
      };

      if (selectedTemplate.id === 'feedback') {
        const resolvedName = templateParams.customer_name ?? templateParams.name ?? email;
        templateParamsPayload.to_name = resolvedName;
        templateParamsPayload.customer_email = email;
        if (!templateParamsPayload.customer_name && resolvedName) {
          templateParamsPayload.customer_name = resolvedName;
        }
      }

      const res = await fetch('/api/admin/test-send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          checkout_id: checkoutId,
          email,
          customer_email: email,
          checkout_url: checkoutUrl,
          template_id: selectedTemplate.templateId,
          template_params: templateParamsPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg(`Erro: ${data?.error?.message || data?.error || 'Não foi possível registrar o teste.'}`);
        return;
      }

      if (data?.discountCode) {
        setMsg(`OK! E-mail enviado (cupom ${data.discountCode})`);
        return;
      }

      setMsg('OK! E-mail enviado.');
    } catch (err) {
      console.error(err);
      setMsg('Erro inesperado ao enviar o teste.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold">Teste de envio</h1>
      <p className="mb-6 text-sm text-slate-400">
        Selecione o template utilizado nos envios do dashboard e personalize os campos dinâmicos antes de disparar um teste.
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="block text-sm font-medium opacity-80">Template</label>
          <select
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
            className="w-full rounded-md bg-slate-800/40 px-3 py-2 text-sm outline-none"
          >
            {TEST_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          {selectedTemplate ? (
            <p className="text-xs text-slate-400">{selectedTemplate.description}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm opacity-80">Seu e-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md bg-slate-800/40 px-3 py-2 outline-none"
            placeholder="voce@exemplo.com"
            required
          />
        </div>

        {selectedTemplate ? (
          <div className="space-y-4">
            {selectedTemplate.fields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-sm opacity-80" htmlFor={`template-${field.key}`}>
                  {field.label}
                </label>
                <input
                  id={`template-${field.key}`}
                  type={field.type ?? 'text'}
                  value={templateParams[field.key] ?? ''}
                  onChange={(event) =>
                    setTemplateParams((prev) => ({ ...prev, [field.key]: event.target.value }))
                  }
                  placeholder={field.placeholder}
                  className="w-full rounded-md bg-slate-800/40 px-3 py-2 outline-none"
                  required={field.key === 'checkout_url'}
                />
              </div>
            ))}
          </div>
        ) : null}

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
