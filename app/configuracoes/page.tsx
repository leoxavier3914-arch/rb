import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore, revalidatePath } from 'next/cache';
import SettingsForm, { type SettingsFormState } from './SettingsForm';
import type { HubSettings, UpdateSettingsInput } from '../../lib/settings';
import { getSettings } from '../../lib/settings';

export const dynamic = 'force-dynamic';

function resolveBaseUrl(): string {
  const headerList = headers();
  const forwardedHost = headerList.get('x-forwarded-host');
  const host = forwardedHost ?? headerList.get('host');

  if (host) {
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    return `${protocol}://${host}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

async function fetchSettingsFromApi(): Promise<HubSettings> {
  'use server';

  const adminCookie = cookies().get('admin_token');
  const baseUrl = resolveBaseUrl();

  const response = await fetch(`${baseUrl}/api/admin/settings`, {
    headers: {
      Authorization: adminCookie?.value ? `Bearer ${adminCookie.value}` : '',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    console.error('[settings] fallback to direct fetch after API failure', response.status);
    return getSettings();
  }

  const payload = await response.json();
  if (!payload?.ok) {
    console.error('[settings] fallback to direct fetch after API error', payload);
    return getSettings();
  }

  return payload.settings as HubSettings;
}

async function saveSettingsAction(_: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  'use server';

  const adminCookie = cookies().get('admin_token');
  const baseUrl = resolveBaseUrl();

  const toNumber = (value: FormDataEntryValue | null): number | null => {
    if (value === null) {
      return null;
    }
    const strValue = typeof value === 'string' ? value.trim() : String(value).trim();
    if (!strValue) {
      return null;
    }
    const parsed = Number(strValue);
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const payload: UpdateSettingsInput = {};

  const defaultDelay = toNumber(formData.get('default_delay_hours'));
  if (defaultDelay !== undefined) {
    payload.default_delay_hours = defaultDelay;
  }

  const defaultExpire = toNumber(formData.get('default_expire_hours'));
  if (defaultExpire !== undefined) {
    payload.default_expire_hours = defaultExpire;
  }

  const webhookToken = formData.get('kiwify_webhook_token');
  if (webhookToken !== undefined) {
    payload.kiwify_webhook_token =
      webhookToken === null ? null : String(webhookToken);
  }

  const adminToken = formData.get('admin_token');
  if (adminToken !== undefined) {
    payload.admin_token = adminToken === null ? null : String(adminToken);
  }

  const response = await fetch(`${baseUrl}/api/admin/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: adminCookie?.value ? `Bearer ${adminCookie.value}` : '',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || !json?.ok) {
    const errors: SettingsFormState['errors'] = json?.issues?.map((issue: any) => ({
      field: issue.path,
      message: issue.message,
    }));

    const message = json?.error === 'invalid_payload'
      ? 'Revise os campos informados e tente novamente.'
      : 'Não foi possível salvar as configurações. Tente novamente em instantes.';

    return {
      ok: false,
      message,
      errors,
      settings: json?.settings ?? (await getSettings()),
    };
  }

  revalidatePath('/configuracoes');

  return {
    ok: true,
    message: 'Configurações salvas com sucesso.',
    errors: [],
    settings: json.settings as HubSettings,
  };
}

export default async function SettingsPage() {
  noStore();

  const adminToken = process.env.ADMIN_TOKEN;
  const cookieStore = cookies();
  const sessionToken = cookieStore.get('admin_token');

  if (adminToken && (!sessionToken || sessionToken.value !== adminToken)) {
    redirect('/login');
  }

  const settings = await fetchSettingsFromApi();

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold text-white">Configurações</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Personalize os prazos, tokens e parâmetros de segurança utilizados pelo hub para automatizar seus fluxos de contato.
        </p>
      </header>

      <SettingsForm initialSettings={settings} action={saveSettingsAction} />
    </main>
  );
}
