import { loadEnv, type AppEnv } from './env';
import { getServiceClient } from './supabase';

export type HealthCheckStatus = 'ok' | 'error';

export type OverallHealthStatus = 'healthy' | 'attention' | 'unhealthy';

export interface HealthCheckItem {
  readonly name: string;
  readonly status: HealthCheckStatus;
  readonly message: string;
  readonly details?: string;
  readonly critical?: boolean;
}

export interface HealthCheckReport {
  readonly status: OverallHealthStatus;
  readonly checks: readonly HealthCheckItem[];
  readonly hasCriticalFailure: boolean;
  readonly timestamp: string;
}

const CRITICAL_SUPABASE_KEYS: (keyof AppEnv)[] = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const CRITICAL_KIWIFY_KEYS: (keyof AppEnv)[] = ['KIWIFY_CLIENT_ID', 'KIWIFY_CLIENT_SECRET', 'KIWIFY_ACCOUNT_ID'];
const OPTIONAL_KEYS: (keyof AppEnv)[] = ['KIWIFY_API_BASE_URL'];

export async function runHealthCheck(): Promise<HealthCheckReport> {
  const checks: HealthCheckItem[] = [];

  const finalize = (): HealthCheckReport => {
    const hasCriticalFailure = checks.some(check => check.critical && check.status === 'error');
    const hasAnyFailure = checks.some(check => check.status === 'error');
    const status: OverallHealthStatus = hasCriticalFailure ? 'unhealthy' : hasAnyFailure ? 'attention' : 'healthy';
    return {
      status,
      checks,
      hasCriticalFailure,
      timestamp: new Date().toISOString()
    };
  };

  let env: AppEnv;
  try {
    env = loadEnv();
    checks.push({
      name: 'Variáveis de ambiente',
      status: 'ok',
      message: 'Variáveis carregadas com sucesso.',
      critical: true
    });
  } catch (error) {
    checks.push({
      name: 'Variáveis de ambiente',
      status: 'error',
      message: 'Falha ao carregar as variáveis de ambiente.',
      details: error instanceof Error ? error.message : String(error),
      critical: true
    });
    return finalize();
  }

  const missingSupabaseKeys = CRITICAL_SUPABASE_KEYS.filter(key => !env?.[key]);
  if (missingSupabaseKeys.length > 0) {
    checks.push({
      name: 'Credenciais do Supabase',
      status: 'error',
      message: 'As variáveis obrigatórias do Supabase não foram definidas.',
      details: `Faltando: ${missingSupabaseKeys.join(', ')}`,
      critical: true
    });
  } else {
    checks.push({
      name: 'Credenciais do Supabase',
      status: 'ok',
      message: 'Credenciais essenciais do Supabase encontradas.',
      critical: true
    });
  }

  const missingKiwifyKeys = CRITICAL_KIWIFY_KEYS.filter(key => !env?.[key]);
  if (missingKiwifyKeys.length > 0) {
    checks.push({
      name: 'Credenciais da Kiwify',
      status: 'error',
      message: 'Informações obrigatórias da Kiwify ausentes.',
      details: `Faltando: ${missingKiwifyKeys.join(', ')}`,
      critical: true
    });
  } else {
    checks.push({
      name: 'Credenciais da Kiwify',
      status: 'ok',
      message: 'Credenciais essenciais da Kiwify encontradas.',
      critical: true
    });
  }

  const missingOptionalKeys = OPTIONAL_KEYS.filter(key => !env?.[key]);
  if (missingOptionalKeys.length > 0) {
    checks.push({
      name: 'Configurações opcionais',
      status: 'error',
      message: 'Algumas variáveis opcionais não foram definidas.',
      details: `Ausentes: ${missingOptionalKeys.join(', ')}`
    });
  } else {
    checks.push({
      name: 'Configurações opcionais',
      status: 'ok',
      message: 'Todas as variáveis opcionais configuradas.'
    });
  }

  let client: ReturnType<typeof getServiceClient>;
  try {
    client = getServiceClient();
    checks.push({
      name: 'Cliente do Supabase',
      status: 'ok',
      message: 'Cliente do Supabase inicializado com sucesso.',
      critical: true
    });
  } catch (error) {
    checks.push({
      name: 'Cliente do Supabase',
      status: 'error',
      message: 'Não foi possível inicializar o cliente do Supabase.',
      details: error instanceof Error ? error.message : String(error),
      critical: true
    });
    return finalize();
  }

  const tables: readonly string[] = ['sales', 'sales_summary'];
  const columnSelections: Record<string, string> = {
    sales: 'id',
    sales_summary: '*'
  };

  for (const table of tables) {
    try {
      const selection = columnSelections[table] ?? '*';
      const { error } = await client.from(table).select(selection).limit(1);
      if (error) {
        throw error;
      }
      checks.push({
        name: `Consulta em ${table}`,
        status: 'ok',
        message: `Consulta básica na tabela "${table}" executada com sucesso.`
      });
    } catch (error) {
      checks.push({
        name: `Consulta em ${table}`,
        status: 'error',
        message: `Falha ao consultar a tabela "${table}".`,
        details: error instanceof Error ? error.message : String(error),
        critical: table === 'sales'
      });
    }
  }

  return finalize();
}
