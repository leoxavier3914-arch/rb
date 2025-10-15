'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { HubSettings } from '../../lib/settings';

export type SettingsFormState = {
  ok: boolean;
  message: string | null;
  errors?: { field: string; message: string }[];
  settings: HubSettings;
};

type SettingsFormProps = {
  initialSettings: HubSettings;
  action: (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;
};

type FormFields = {
  default_delay_hours: string;
  default_expire_hours: string;
  kiwify_webhook_token: string;
  admin_token: string;
};

function toFieldState(settings: HubSettings): FormFields {
  return {
    default_delay_hours: settings.default_delay_hours?.toString() ?? '',
    default_expire_hours: settings.default_expire_hours?.toString() ?? '',
    kiwify_webhook_token: settings.kiwify_webhook_token ?? '',
    admin_token: settings.admin_token ?? '',
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
    >
      {pending ? 'Salvando…' : 'Salvar alterações'}
    </button>
  );
}

export default function SettingsForm({ initialSettings, action }: SettingsFormProps) {
  const initialState: SettingsFormState = useMemo(
    () => ({ ok: true, message: null, settings: initialSettings }),
    [initialSettings],
  );

  const [state, formAction] = useFormState(action, initialState);
  const [, startTransition] = useTransition();
  const [fields, setFields] = useState<FormFields>(() => toFieldState(initialSettings));

  useEffect(() => {
    setFields(toFieldState(initialSettings));
  }, [initialSettings]);

  useEffect(() => {
    if (state.settings) {
      startTransition(() => {
        setFields(toFieldState(state.settings));
      });
    }
  }, [state.settings, startTransition]);

  const errorsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of state.errors ?? []) {
      if (!map.has(issue.field)) {
        map.set(issue.field, issue.message);
      }
    }
    return map;
  }, [state.errors]);

  const feedback = state.message ? (
    <div
      role="status"
      className={`rounded-md border px-3 py-2 text-sm ${state.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-red-500/40 bg-red-500/10 text-red-200'}`}
    >
      {state.message}
    </div>
  ) : null;

  return (
    <form action={formAction} className="space-y-10">
      <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6 shadow-sm shadow-black/40">
        <header>
          <h2 className="text-lg font-semibold text-white">Prazos</h2>
          <p className="text-sm text-slate-400">
            Defina os prazos padrão utilizados para agendamento e expiração dos lembretes.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-200">Aguardar antes do disparo (horas)</span>
            <input
              name="default_delay_hours"
              type="number"
              min={0}
              max={720}
              value={fields.default_delay_hours}
              onChange={(event) =>
                setFields((prev) => ({ ...prev, default_delay_hours: event.target.value }))
              }
              className="w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/30 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
              placeholder="24"
            />
            <span className="text-xs text-slate-400">
              Utilizado como atraso padrão antes de reagendar contatos ou disparos automáticos.
            </span>
            {errorsMap.has('default_delay_hours') ? (
              <span className="text-xs font-medium text-red-300">{errorsMap.get('default_delay_hours')}</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-200">Expiração dos eventos (horas)</span>
            <input
              name="default_expire_hours"
              type="number"
              min={0}
              max={1440}
              value={fields.default_expire_hours}
              onChange={(event) =>
                setFields((prev) => ({ ...prev, default_expire_hours: event.target.value }))
              }
              className="w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/30 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
              placeholder="72"
            />
            <span className="text-xs text-slate-400">
              Define por quanto tempo os eventos ficam ativos antes de serem considerados expirados.
            </span>
            {errorsMap.has('default_expire_hours') ? (
              <span className="text-xs font-medium text-red-300">{errorsMap.get('default_expire_hours')}</span>
            ) : null}
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6 shadow-sm shadow-black/40">
        <header>
          <h2 className="text-lg font-semibold text-white">Credenciais</h2>
          <p className="text-sm text-slate-400">Tokens utilizados para validar integrações com a Kiwify.</p>
        </header>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-200">Token do Webhook</span>
          <input
            name="kiwify_webhook_token"
            type="text"
            autoComplete="off"
            value={fields.kiwify_webhook_token}
            onChange={(event) =>
              setFields((prev) => ({ ...prev, kiwify_webhook_token: event.target.value }))
            }
            className="w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/30 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
            placeholder="Informe o token recebido na Kiwify"
          />
          <span className="text-xs text-slate-400">
            Utilizado para validar requisições recebidas via{' '}
            <code className="font-mono text-xs text-slate-300">/api/kiwify/webhook</code>.
          </span>
          {errorsMap.has('kiwify_webhook_token') ? (
            <span className="text-xs font-medium text-red-300">{errorsMap.get('kiwify_webhook_token')}</span>
          ) : null}
        </label>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6 shadow-sm shadow-black/40">
        <header>
          <h2 className="text-lg font-semibold text-white">Segurança</h2>
          <p className="text-sm text-slate-400">Controle o acesso ao painel administrativo definindo um token seguro.</p>
        </header>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-200">Token administrativo</span>
          <input
            name="admin_token"
            type="password"
            autoComplete="new-password"
            value={fields.admin_token}
            onChange={(event) => setFields((prev) => ({ ...prev, admin_token: event.target.value }))}
            className="w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/30 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
            placeholder="Defina um token com pelo menos 6 caracteres"
          />
          <span className="text-xs text-slate-400">
            O token é exigido para acessar áreas protegidas do hub. Compartilhe apenas com sua equipe.
          </span>
          {errorsMap.has('admin_token') ? (
            <span className="text-xs font-medium text-red-300">{errorsMap.get('admin_token')}</span>
          ) : null}
        </label>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {feedback}
        <SubmitButton />
      </div>
    </form>
  );
}
