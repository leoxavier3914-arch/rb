import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase não configurado para estado de sincronização');
}

const sb = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } }) : null;
const KEY = 'kfy_sync_cursor';

export async function getSyncCursor() {
  if (!sb) {
    throw new Error('Supabase não configurado');
  }

  const { data, error } = await sb.from('app_state').select('value').eq('id', KEY).maybeSingle();
  if (error) {
    throw error;
  }
  return data?.value ?? null;
}

export async function setSyncCursor(cursor: any, stats?: any) {
  if (!sb) {
    throw new Error('Supabase não configurado');
  }

  const payload = {
    cursor,
    lastRunAt: new Date().toISOString(),
    lastStats: stats ?? null,
  };

  const { error } = await sb.from('app_state').upsert({ id: KEY, value: payload });
  if (error) {
    throw error;
  }
}

