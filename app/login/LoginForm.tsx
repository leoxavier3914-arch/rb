'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { ActionState } from './types';

type LoginFormProps = {
  action: (state: ActionState | undefined, formData: FormData) => Promise<ActionState>;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'Validando…' : 'Entrar'}
    </button>
  );
}

export default function LoginForm({ action }: LoginFormProps) {
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-left text-sm font-medium text-slate-200">
        Token administrativo
        <input
          type="password"
          name="token"
          placeholder="Insira o token fornecido"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
          required
        />
      </label>
      {state?.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
