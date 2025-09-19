import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import LoginForm from './LoginForm';
import { authenticate } from './actions';

function Section({ children }: { children: ReactNode }) {
  return <section className="w-full max-w-md space-y-6 rounded-xl border border-slate-800 bg-slate-900/70 p-8">{children}</section>;
}

export default function LoginPage() {
  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');

  if (adminToken && token?.value === adminToken) {
    redirect('/');
  }

  return (
    <main className="flex flex-1 items-center justify-center">
      <Section>
        <header className="space-y-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">Acesso restrito</p>
          <h1 className="text-2xl font-bold text-white">Entrar no painel</h1>
          <p className="text-sm text-slate-400">Informe o token administrativo definido na variável ADMIN_TOKEN.</p>
        </header>
        <LoginForm action={authenticate} />
      </Section>
    </main>
  );
}
