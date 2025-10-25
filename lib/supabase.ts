import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './env';

export function getServiceClient() {
  const env = loadEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service role não configurado');
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false
    }
  });
}
