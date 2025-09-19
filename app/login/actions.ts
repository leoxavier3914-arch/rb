'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ActionState } from './types';

export async function authenticate(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const submittedToken = formData.get('token')?.toString().trim();
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    return { error: 'ADMIN_TOKEN não configurado no servidor.' };
  }

  if (!submittedToken) {
    return { error: 'Informe o token de acesso.' };
  }

  if (submittedToken !== adminToken) {
    return { error: 'Token inválido.' };
  }

  cookies().set('admin_token', submittedToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });

  redirect('/');
}
