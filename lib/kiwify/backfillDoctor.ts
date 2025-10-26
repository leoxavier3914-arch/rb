import { promises as fs } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { buildSalesWindows, previewSalesRangeForDoctor } from './syncEngine';
import { prepareCustomerUpsertRows } from './writes';
import type { CustomerRow } from './mappers';
import { getServiceClient } from '@/lib/supabase';

export interface BackfillDoctorCheck {
  readonly id: string;
  readonly label: string;
  readonly pass: boolean;
  readonly details?: string;
}

export interface BackfillDoctorReport {
  readonly ok: boolean;
  readonly checks: readonly BackfillDoctorCheck[];
  readonly recommendations: readonly string[];
}

const PROJECT_ROOT = process.cwd();
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORED_DIRECTORIES = new Set(['node_modules', '.next', '.git', 'dist', 'build']);
const CUSTOMER_ENDPOINT_PATTERNS = ['/v1/customers/list', '/v1/customers'];
const ROUTE_ROOTS = ['app/api/kfy', 'app/api/healthz'];
const TARGET_TABLES = [
  'kfy_customers',
  'kfy_products',
  'kfy_sales',
  'kfy_subscriptions',
  'kfy_enrollments',
  'kfy_coupons',
  'kfy_refunds',
  'kfy_payouts'
];
const TARGET_FOREIGN_KEYS = [
  'kfy_sales_customer_id_fkey',
  'kfy_orders_customer_id_fkey',
  'kfy_subscriptions_customer_id_fkey',
  'kfy_enrollments_customer_id_fkey'
];

export async function runBackfillDoctor(): Promise<BackfillDoctorReport> {
  const checks: BackfillDoctorCheck[] = [];
  const recommendations: string[] = [];

  let supabaseClient: ReturnType<typeof getServiceClient> | null = null;
  let supabaseError: Error | null = null;
  try {
    supabaseClient = getServiceClient();
  } catch (error) {
    supabaseError = error instanceof Error ? error : new Error(String(error));
  }

  checks.push(await checkNoCustomersEndpointUsage());
  checks.push(await checkSalesWindows());
  checks.push(await checkNo1970Fallback());
  checks.push(await checkCustomersIdTextNoIdentity(supabaseClient, supabaseError));
  checks.push(await checkForeignKeysRestrict(supabaseClient, supabaseError));
  checks.push(await checkCustomersUpsertNoPkChange());
  checks.push(await checkWriteOrder());
  checks.push(await checkOptional404Handling());
  checks.push(await checkRoutesRuntime());
  checks.push(await checkExportsBucket(supabaseClient, supabaseError));

  const ok = checks.every((entry) => entry.pass);

  return { ok, checks, recommendations };
}

async function checkNoCustomersEndpointUsage(): Promise<BackfillDoctorCheck> {
  const id = 'no_customers_endpoint_usage';
  const label = 'Não chama /v1/customers diretamente';
  const searchRoots = ['lib/kiwify', 'app/api/kfy', 'app/(app)'];
  const matches: string[] = [];

  for (const root of searchRoots) {
    const files = await collectCodeFiles(root);
    for (const file of files) {
      const content = await readFileSafe(file);
      if (!content) {
        continue;
      }
      for (const pattern of CUSTOMER_ENDPOINT_PATTERNS) {
        if (content.includes(pattern)) {
          matches.push(relative(PROJECT_ROOT, file));
          break;
        }
      }
    }
  }

  if (matches.length === 0) {
    return { id, label, pass: true };
  }

  return { id, label, pass: false, details: `Encontrado uso em: ${matches.join(', ')}` };
}

async function checkSalesWindows(): Promise<BackfillDoctorCheck> {
  const id = 'sales_windows_le_90d';
  const label = 'Janelas de vendas com no máximo 90 dias';
  const windows = buildSalesWindows('2024-01-01', '2024-12-31');

  let valid = windows.length > 0;
  let lastEnd: string | null = null;

  for (const window of windows) {
    const start = Date.parse(window.start);
    const end = Date.parse(window.end);
    const diffDays = Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
    if (Number.isNaN(start) || Number.isNaN(end) || diffDays > 90) {
      valid = false;
      break;
    }
    if (lastEnd && Date.parse(lastEnd) + 24 * 60 * 60 * 1000 !== start) {
      valid = false;
      break;
    }
    lastEnd = window.end;
  }

  return { id, label, pass: valid };
}

async function checkNo1970Fallback(): Promise<BackfillDoctorCheck> {
  const id = 'no_1970_default';
  const label = 'Fallback padrão de vendas evita 1970';
  const range = await previewSalesRangeForDoctor();

  if (!range) {
    return { id, label, pass: false, details: 'Intervalo padrão não pôde ser calculado.' };
  }

  const minAllowed = new Date();
  minAllowed.setUTCFullYear(minAllowed.getUTCFullYear() - 6);
  const pass = range.start.getTime() >= minAllowed.getTime();

  return { id, label, pass, details: pass ? undefined : `Início calculado em ${range.start.toISOString()}` };
}

async function checkCustomersIdTextNoIdentity(
  client: ReturnType<typeof getServiceClient> | null,
  clientError: Error | null
): Promise<BackfillDoctorCheck> {
  const id = 'customers_id_text_no_identity';
  const label = 'IDs externos armazenados como TEXT sem identity/default';

  if (!client) {
    return { id, label, pass: false, details: clientError?.message ?? 'Supabase não configurado.' };
  }

  const { data, error } = await client
    .from('kfy_doctor_columns')
    .select('table_name, data_type, is_identity, column_default')
    .eq('column_name', 'id')
    .in('table_name', TARGET_TABLES);

  if (error) {
    return { id, label, pass: false, details: error.message ?? 'Falha ao consultar colunas.' };
  }

  const rows = data ?? [];
  const present = new Set(rows.map((row) => String(row.table_name ?? '')));
  const missingTables = TARGET_TABLES.filter((table) => !present.has(table));
  if (missingTables.length > 0) {
    return { id, label, pass: false, details: `Tabelas ausentes: ${missingTables.join(', ')}` };
  }

  const invalid = rows.filter((row) => {
    const dataType = String(row.data_type ?? '').toLowerCase();
    const isIdentity = String(row.is_identity ?? '').toUpperCase() === 'YES';
    const hasDefault = row.column_default !== null && row.column_default !== undefined;
    return dataType !== 'text' || isIdentity || hasDefault;
  });

  if (invalid.length === 0) {
    return { id, label, pass: true };
  }

  const details = invalid
    .map((row) => `${row.table_name ?? 'unknown'} => tipo=${row.data_type}, identity=${row.is_identity}, default=${row.column_default ?? 'null'}`)
    .join('; ');
  return { id, label, pass: false, details };
}

async function checkForeignKeysRestrict(
  client: ReturnType<typeof getServiceClient> | null,
  clientError: Error | null
): Promise<BackfillDoctorCheck> {
  const id = 'fks_restrict_no_cascade';
  const label = 'FKs de clientes com RESTRICT e sem CASCADE';

  if (!client) {
    return { id, label, pass: false, details: clientError?.message ?? 'Supabase não configurado.' };
  }

  const { data, error } = await client
    .from('kfy_doctor_foreign_keys')
    .select('constraint_name, update_rule, delete_rule')
    .in('constraint_name', TARGET_FOREIGN_KEYS);

  if (error) {
    return { id, label, pass: false, details: error.message ?? 'Falha ao consultar FKs.' };
  }

  const rows = data ?? [];
  const present = new Set(rows.map((row) => String(row.constraint_name ?? '')));
  const missingConstraints = TARGET_FOREIGN_KEYS.filter((name) => !present.has(name));
  if (missingConstraints.length > 0) {
    return { id, label, pass: false, details: `Constraints ausentes: ${missingConstraints.join(', ')}` };
  }

  const violations = rows.filter((row) => {
    const updateRule = String(row.update_rule ?? '').toUpperCase();
    const deleteRule = String(row.delete_rule ?? '').toUpperCase();
    return (updateRule !== 'RESTRICT' && updateRule !== 'NO ACTION') || (deleteRule !== 'RESTRICT' && deleteRule !== 'NO ACTION');
  });

  if (violations.length === 0) {
    return { id, label, pass: true };
  }

  const details = violations
    .map((row) => `${row.constraint_name}: update=${row.update_rule}, delete=${row.delete_rule}`)
    .join('; ');
  return { id, label, pass: false, details };
}

async function checkCustomersUpsertNoPkChange(): Promise<BackfillDoctorCheck> {
  const id = 'customers_upsert_no_pk_change';
  const label = 'Upsert de clientes não altera PK';

  const sample: CustomerRow = {
    id: 'cust_upstream',
    external_id: 'cust_external',
    name: 'Sample',
    email: 'buyer@example.com',
    phone: null,
    country: null,
    state: null,
    city: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    raw: {}
  };
  const existing = new Map<string, string>([['cust_external', 'cust_existing']]);
  const prepared = prepareCustomerUpsertRows([sample], existing);

  const pass = prepared.length === 1 && prepared[0]?.id === 'cust_existing';
  return { id, label, pass };
}

async function checkWriteOrder(): Promise<BackfillDoctorCheck> {
  const id = 'write_order_customer_then_sale';
  const label = 'Ordem de escrita garante cliente antes de venda';

  const syncEngineSource = await readFileSafe(join(PROJECT_ROOT, 'lib/kiwify/syncEngine.ts'));
  const webhookSource = await readFileSafe(join(PROJECT_ROOT, 'lib/kiwify/webhookProcessor.ts'));

  if (!syncEngineSource || !webhookSource) {
    return { id, label, pass: false, details: 'Não foi possível carregar arquivos principais.' };
  }

  const derivedIndex = syncEngineSource.indexOf('upsertDerivedCustomers');
  const writerIndex = syncEngineSource.indexOf('resourceConfig.writer');
  const retryIndex = syncEngineSource.indexOf('retrySalesAfterCustomerUpsert');
  const syncPass = derivedIndex !== -1 && writerIndex !== -1 && derivedIndex < writerIndex && retryIndex !== -1;

  const webhookCustomerIndex = webhookSource.indexOf('await upsertCustomer');
  const webhookSaleIndex = webhookSource.indexOf('await attemptSaleUpsertWithRetry');
  const webhookPass = webhookCustomerIndex !== -1 && webhookSaleIndex !== -1 && webhookCustomerIndex < webhookSaleIndex;

  return {
    id,
    label,
    pass: syncPass && webhookPass,
    details: syncPass && webhookPass ? undefined : 'Verifique ordem de escrita em sync/webhook.'
  };
}

async function checkOptional404Handling(): Promise<BackfillDoctorCheck> {
  const id = 'optional_404_mark_unsupported';
  const label = 'Recursos opcionais marcam unsupported em 404/HTML';
  const source = await readFileSafe(join(PROJECT_ROOT, 'lib/kiwify/syncEngine.ts'));
  if (!source) {
    return { id, label, pass: false, details: 'Arquivo syncEngine.ts indisponível.' };
  }

  const hasGuard = source.includes('resource_not_found_skip') && source.includes('setUnsupportedResources');
  return { id, label, pass: hasGuard };
}

async function checkRoutesRuntime(): Promise<BackfillDoctorCheck> {
  const id = 'routes_runtime_node_max300';
  const label = 'Rotas críticas usam runtime nodejs e maxDuration 300';

  const routeFiles: string[] = [];
  for (const root of ROUTE_ROOTS) {
    routeFiles.push(...(await collectRouteFiles(root)));
  }

  const missing: string[] = [];
  for (const file of routeFiles) {
    const content = await readFileSafe(file);
    if (!content) {
      missing.push(relative(PROJECT_ROOT, file));
      continue;
    }
    if (!content.includes("export const runtime = 'nodejs'")) {
      missing.push(relative(PROJECT_ROOT, file));
      continue;
    }
    if (!content.includes('export const maxDuration = 300')) {
      missing.push(relative(PROJECT_ROOT, file));
    }
  }

  if (missing.length === 0) {
    return { id, label, pass: true };
  }

  return { id, label, pass: false, details: `Faltando configuração em: ${missing.join(', ')}` };
}

async function checkExportsBucket(
  client: ReturnType<typeof getServiceClient> | null,
  clientError: Error | null
): Promise<BackfillDoctorCheck> {
  const id = 'storage_bucket_exports_exists';
  const label = 'Bucket exports disponível no storage';

  if (!client) {
    return { id, label, pass: false, details: clientError?.message ?? 'Supabase não configurado.' };
  }

  try {
    const { error } = await client.storage.getBucket('exports');
    if (error) {
      return { id, label, pass: false, details: error.message ?? 'Bucket exports ausente.' };
    }
    return { id, label, pass: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar storage.';
    return { id, label, pass: false, details: message };
  }
}

async function collectCodeFiles(rootRelative: string): Promise<string[]> {
  const start = join(PROJECT_ROOT, rootRelative);
  const files: string[] = [];
  await walk(start, files);
  return files;
}

async function collectRouteFiles(rootRelative: string): Promise<string[]> {
  const start = join(PROJECT_ROOT, rootRelative);
  const files: string[] = [];
  await walk(start, files, (entryPath) => entryPath.endsWith('route.ts'));
  return files;
}

async function walk(
  current: string,
  output: string[],
  fileFilter?: (path: string) => boolean
): Promise<void> {
  let stat;
  try {
    stat = await fs.stat(current);
  } catch {
    return;
  }

  if (stat.isDirectory()) {
    const base = current.split(/[\\/]/).pop() ?? '';
    if (IGNORED_DIRECTORIES.has(base)) {
      return;
    }
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath, output, fileFilter);
      } else if (entry.isFile()) {
        const add = fileFilter ? fileFilter(entryPath) : CODE_EXTENSIONS.has(extname(entry.name));
        if (add) {
          output.push(entryPath);
        }
      }
    }
  } else if (stat.isFile()) {
    const add = fileFilter ? fileFilter(current) : CODE_EXTENSIONS.has(extname(current));
    if (add) {
      output.push(current);
    }
  }
}

async function readFileSafe(path: string): Promise<string | null> {
  try {
    return await fs.readFile(path, 'utf8');
  } catch {
    return null;
  }
}
