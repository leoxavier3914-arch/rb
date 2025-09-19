import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient<any> | null = null;

function ensureEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export function getSupabaseAdmin(): SupabaseClient<any> {
  if (client) {
    return client;
  }

  const url = ensureEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);

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
