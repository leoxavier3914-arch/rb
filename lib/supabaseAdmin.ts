import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readEnvValue } from './env';

let client: SupabaseClient<any> | null = null;

function ensureEnv(name: string, ...fallbacks: string[]): string {
  const value = readEnvValue(name, ...fallbacks);
  if (!value) {
    const candidates = [name, ...fallbacks].join('/');
    throw new Error(`Variável de ambiente obrigatória ausente: ${candidates}`);
  }
  return value;
}

export function getSupabaseAdmin(): SupabaseClient<any> {
  if (client) {
    return client;
  }

  const url = ensureEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
  const serviceRoleKey = ensureEnv(
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_ROLE',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_SECRET_KEY',
  );

  client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'rb-kiwify-hub-admin',
      },
    },
  });

  return client;
}
