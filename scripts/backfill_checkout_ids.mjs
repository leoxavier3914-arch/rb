#!/usr/bin/env node
import crypto from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

function readEnv(name, fallbacks = []) {
  const candidates = [name, ...fallbacks];
  for (const candidate of candidates) {
    const raw = process.env[candidate];
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function normalizeString(value) {
  if (value == null) return null;
  if (typeof value !== 'string') {
    return String(value);
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeEmail(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function deepWalk(obj, visit, path = []) {
  if (obj === null || obj === undefined) return false;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i += 1) {
      if (deepWalk(obj[i], visit, [...path, String(i)])) return true;
    }
    return false;
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (visit(key, value, [...path, key]) || deepWalk(value, visit, [...path, key])) return true;
    }
    return false;
  }
  return false;
}

function pickByKeys(obj, keys, test) {
  if (!obj || typeof obj !== 'object') return null;
  const normalizedKeys = keys.map((key) => key.toLowerCase());
  let found = null;
  deepWalk(obj, (key, value) => {
    if (normalizedKeys.some((candidate) => candidate === key.toLowerCase()) && (!test || test(value))) {
      found = value;
      return true;
    }
    return false;
  });
  return found;
}

function findEmailDeep(obj) {
  const byKey = pickByKeys(
    obj,
    ['email', 'customer_email', 'buyer_email', 'user_email', 'mail'],
    (value) => typeof value === 'string' && EMAIL_RE.test(value),
  );
  if (byKey) return String(byKey);

  let found = null;
  deepWalk(obj, (_key, value) => {
    if (typeof value === 'string' && EMAIL_RE.test(value)) {
      found = value;
      return true;
    }
    return false;
  });
  return found;
}

function findProductNameDeep(obj) {
  const preferred = pickByKeys(
    obj,
    ['product_name', 'offer_name', 'product_title', 'item_title', 'course_name', 'plan_name'],
    (value) => typeof value === 'string' && value.trim().length > 0,
  );
  if (preferred) return String(preferred).trim();

  let found = null;
  deepWalk(obj, (key, value, path) => {
    if (typeof value !== 'string' || !value.trim()) return false;
    const normalizedKey = key.toLowerCase();
    const normalizedPath = path.join('.').toLowerCase();
    const looksLikeProductPath = /(^|\.)(product|products|item|items|order_items|line_items|order_products)(\.|$)/i.test(
      normalizedPath,
    );
    if (looksLikeProductPath && (normalizedKey === 'title' || normalizedKey === 'name')) {
      found = value.trim();
      return true;
    }
    return false;
  });
  if (found) return found;

  const listKeys = ['order_items', 'items', 'products', 'order_products', 'line_items', 'purchases', 'courses'];
  for (const key of listKeys) {
    const arr = pickByKeys(obj, [key], (value) => Array.isArray(value));
    if (!arr || !arr.length) continue;
    for (const item of arr) {
      if (!item) continue;
      if (typeof item.title === 'string' && item.title.trim()) return item.title.trim();
      if (typeof item.name === 'string' && item.name.trim()) return item.name.trim();
      if (item.product) {
        if (typeof item.product.title === 'string' && item.product.title.trim()) return item.product.title.trim();
        if (typeof item.product.name === 'string' && item.product.name.trim()) return item.product.name.trim();
      }
    }
  }

  const alt = pickByKeys(
    obj,
    ['product_type', 'plan_type', 'order_ref'],
    (value) => typeof value === 'string' && value.trim().length > 0,
  );
  return alt ? String(alt).trim() : null;
}

function normalizeIdCandidate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function findProductIdDeep(obj) {
  const preferred = pickByKeys(
    obj,
    [
      'product_id',
      'productId',
      'offer_id',
      'offerId',
      'plan_id',
      'planId',
      'course_id',
      'courseId',
      'item_id',
      'itemId',
      'product_code',
      'productCode',
      'sku',
      'product_slug',
      'productSlug',
    ],
    (value) => normalizeIdCandidate(value) !== null,
  );
  if (preferred != null) {
    const normalized = normalizeIdCandidate(preferred);
    if (normalized) return normalized;
  }

  let found = null;
  deepWalk(obj, (key, value, path) => {
    const normalized = normalizeIdCandidate(value);
    if (!normalized) return false;

    const normalizedKey = key.toLowerCase();
    const normalizedPath = path.join('.').toLowerCase();
    const looksLikeProductPath = /(^|\.)(product|products|item|items|order_items|line_items|order_products|purchases|courses)(\.|$)/i.test(
      normalizedPath,
    );

    if (
      looksLikeProductPath &&
      ['id', 'product_id', 'productid', 'offer_id', 'offerid', 'sku', 'code', 'slug'].includes(normalizedKey)
    ) {
      found = normalized;
      return true;
    }
    return false;
  });
  if (found) return found;

  const listKeys = ['order_items', 'items', 'products', 'order_products', 'line_items', 'purchases', 'courses'];
  for (const key of listKeys) {
    const arr = pickByKeys(obj, [key], (value) => Array.isArray(value));
    if (!arr || !arr.length) continue;
    for (const item of arr) {
      if (!item) continue;
      const direct = normalizeIdCandidate(item.product_id ?? item.id ?? item.sku);
      if (direct) return direct;
      if (item.product) {
        const nested = normalizeIdCandidate(
          item.product.product_id ?? item.product.id ?? item.product.sku ?? item.product.code,
        );
        if (nested) return nested;
      }
    }
  }

  return null;
}

function normalizeProductComponent(row, payload) {
  const candidates = [
    row.product_id,
    row.productId,
    findProductIdDeep(payload),
    row.product_title,
    row.productTitle,
    row.product_name,
    findProductNameDeep(payload),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeString(candidate);
    if (normalized) {
      return normalized
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    }
  }
  return null;
}

function normalizeCheckoutCodeCandidate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^[A-Za-z0-9_-]{4,120}$/.test(trimmed)) {
      return trimmed.toLowerCase();
    }

    if (trimmed.startsWith('http')) {
      try {
        const url = new URL(trimmed);
        const segments = url.pathname.split('/').filter(Boolean);
        const last = segments.pop();
        if (last && /^[A-Za-z0-9_-]{4,120}$/.test(last)) {
          return last.toLowerCase();
        }
      } catch {
        // ignore parsing errors
      }
    }
  }
  return null;
}

function findCheckoutUrl(row, payload) {
  const candidates = [row.checkout_url, pickByKeys(payload, ['checkout_url', 'payment_link', 'url'])];
  for (const candidate of candidates) {
    const normalized = normalizeString(candidate);
    if (normalized) return normalized;
  }

  let best = null;
  deepWalk(payload, (key, value) => {
    if (typeof value === 'string' && value.startsWith('http')) {
      if (/kiwify\.com\.br|pay\.kiwify/i.test(value)) {
        best = value;
        return true;
      }
      if (!best) best = value;
    }
    return false;
  });
  return best;
}

function findCheckoutCode(row, payload) {
  const direct = pickByKeys(payload, ['checkout_link', 'checkout_code', 'cart_code', 'order_ref'], (value) =>
    normalizeCheckoutCodeCandidate(value) !== null,
  );
  if (direct != null) {
    const normalized = normalizeCheckoutCodeCandidate(direct);
    if (normalized) return normalized;
  }

  const url = findCheckoutUrl(row, payload);
  if (url) {
    const normalized = normalizeCheckoutCodeCandidate(url);
    if (normalized) return normalized;
  }

  const fallback = normalizeCheckoutCodeCandidate(row.checkout_id);
  return fallback ?? null;
}

function findDirectCheckoutId(row, payload) {
  const direct = normalizeString(
    row.checkout_id ??
      pickByKeys(payload, ['checkout_id', 'purchase_id', 'order_id', 'cart_id', 'id', 'order_ref']),
  );
  return direct ?? null;
}

function resolveCheckoutId(row) {
  let payload = row.payload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }
  if (payload === null || typeof payload !== 'object') {
    payload = {};
  }

  const email =
    normalizeEmail(row.customer_email ?? row.email) ??
    normalizeEmail(findEmailDeep(payload));

  const productComponent = normalizeProductComponent(row, payload);
  const checkoutCode = findCheckoutCode(row, payload);
  const direct = findDirectCheckoutId(row, payload);

  const seeds = [];
  if (email && checkoutCode) {
    seeds.push(`${email}::checkout::${checkoutCode}`);
  }
  if (email && productComponent) {
    seeds.push(`${email}::product::${productComponent}`);
  }
  if (productComponent && checkoutCode) {
    seeds.push(`product::${productComponent}::checkout::${checkoutCode}`);
  }

  const hashedCandidates = seeds.map((seed) => crypto.createHash('sha256').update(seed).digest('hex'));

  const ordered = [];
  const seen = new Set();
  for (const candidate of [...hashedCandidates, direct]) {
    if (!candidate) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    ordered.push(candidate);
  }

  if (!ordered.length) {
    return { primary: direct ?? null, candidates: direct ? [direct] : [] };
  }

  return { primary: ordered[0], candidates: ordered };
}

function scoreRow(row) {
  let score = 0;
  if (row.paid) score += 100;
  const status = normalizeString(row.status)?.toLowerCase();
  if (status === 'converted') score += 50;
  if (status === 'sent') score += 30;
  if (status === 'pending') score += 10;
  if (row.sent_at) score += 5;
  if (row.updated_at) score += 1;
  return score;
}

function timestampValue(row) {
  const fallback = row.updated_at ?? row.created_at ?? null;
  if (!fallback) return 0;
  const time = new Date(fallback).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function pickFirst(rows, field, predicate) {
  for (const row of rows) {
    const value = row[field];
    if (predicate ? predicate(value, row) : value !== null && value !== undefined) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) continue;
        return trimmed;
      }
      return value;
    }
  }
  return null;
}

function pickTrafficSource(rows) {
  let best = null;
  for (const row of rows) {
    const value = normalizeString(row.traffic_source);
    if (!value) continue;
    if (!best) {
      best = value;
      continue;
    }
    const specificBest = best.includes('.');
    const specificCandidate = value.includes('.');
    if (!specificBest && specificCandidate) {
      best = value;
    }
  }
  return best;
}

function resolveStatus(rows, paidFlag) {
  if (paidFlag) return 'converted';
  const priority = ['converted', 'sent', 'pending'];
  const found = new Set();
  for (const row of rows) {
    const value = normalizeString(row.status)?.toLowerCase();
    if (value) found.add(value);
  }
  for (const candidate of priority) {
    if (found.has(candidate)) return candidate;
  }
  return found.values().next().value ?? 'pending';
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    apply: args.has('--apply'),
    deleteDuplicates: args.has('--delete-duplicates'),
  };
}

async function fetchAllRows(client, pageSize = 1000) {
  const rows = [];
  let from = 0;
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await client
      .from('abandoned_emails')
      .select(
        [
          'id',
          'checkout_id',
          'email',
          'customer_email',
          'customer_name',
          'product_id',
          'product_name',
          'product_title',
          'checkout_url',
          'payload',
          'status',
          'paid',
          'paid_at',
          'discount_code',
          'source',
          'traffic_source',
          'last_event',
          'schedule_at',
          'sent_at',
          'expires_at',
          'created_at',
          'updated_at',
        ].join(', ')
      )
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function buildUpdatePayload(rows, deterministicId, canonicalId) {
  const ranked = rows
    .slice()
    .sort((a, b) => {
      const scoreDiff = scoreRow(b) - scoreRow(a);
      if (scoreDiff !== 0) return scoreDiff;
      return timestampValue(b) - timestampValue(a);
    });

  const paidFlag = ranked.some((row) => row.paid === true);
  const bestPaidAt = pickFirst(ranked, 'paid_at', (value, row) => row.paid && normalizeString(value));

  const payload = {
    checkout_id: deterministicId,
    product_id: pickFirst(ranked, 'product_id', normalizeString),
    product_title:
      pickFirst(ranked, 'product_title', normalizeString) ??
      pickFirst(ranked, 'product_name', normalizeString),
    product_name:
      pickFirst(ranked, 'product_name', normalizeString) ??
      pickFirst(ranked, 'product_title', normalizeString),
    customer_name: pickFirst(ranked, 'customer_name', normalizeString),
    checkout_url: pickFirst(ranked, 'checkout_url', normalizeString),
    discount_code: pickFirst(ranked, 'discount_code', normalizeString),
    source: pickFirst(ranked, 'source', normalizeString),
    traffic_source: pickTrafficSource(ranked),
    last_event: pickFirst(ranked, 'last_event', normalizeString),
    schedule_at: pickFirst(ranked, 'schedule_at', Boolean),
    sent_at: pickFirst(ranked, 'sent_at', Boolean),
    expires_at: pickFirst(ranked, 'expires_at', Boolean),
    paid: paidFlag,
    paid_at: bestPaidAt ?? null,
    status: resolveStatus(ranked, paidFlag),
  };

  // Remove nullish values to avoid overwriting with nulls unintentionally.
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) {
      delete payload[key];
    }
  }

  // Always ensure checkout_id is present.
  payload.checkout_id = deterministicId;

  return payload;
}

async function main() {
  const { apply, deleteDuplicates } = parseArgs();

  const supabaseUrl = readEnv('SUPABASE_URL', ['NEXT_PUBLIC_SUPABASE_URL']);
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY', [
    'SUPABASE_SERVICE_ROLE',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_SECRET_KEY',
  ]);

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE environment variables.');
    process.exit(1);
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'abandoned-emails-backfill/1.0.0' } },
  });

  console.log('Fetching existing rows...');
  const rows = await fetchAllRows(client);
  console.log(`Fetched ${rows.length} rows from abandoned_emails.`);

  const groups = new Map();
  const skipped = [];

  for (const row of rows) {
    const resolution = resolveCheckoutId(row);
    if (!resolution.primary) {
      skipped.push({ row, reason: 'missing email, product identifier or checkout reference' });
      continue;
    }
    const deterministic = resolution.primary;
    if (!groups.has(deterministic)) {
      groups.set(deterministic, []);
    }
    groups.get(deterministic).push({ ...row, deterministic_id: deterministic, checkout_candidates: resolution.candidates });
  }

  const updates = [];
  const duplicates = [];

  for (const [deterministicId, groupedRows] of groups.entries()) {
    const canonical = groupedRows.find((row) => row.checkout_id === deterministicId);
    const ranked = groupedRows
      .slice()
      .sort((a, b) => {
        const scoreDiff = scoreRow(b) - scoreRow(a);
        if (scoreDiff !== 0) return scoreDiff;
        return timestampValue(b) - timestampValue(a);
      });

    const target = canonical ?? ranked[0];
    const payload = buildUpdatePayload(groupedRows, deterministicId, target.id);

    const needsUpdate = target.checkout_id !== deterministicId || Object.keys(payload).some((key) => {
      if (key === 'checkout_id') return target.checkout_id !== deterministicId;
      const current = target[key];
      const next = payload[key];
      if (next === undefined) return false;
      if (next === null && (current === null || current === undefined)) return false;
      if (next === null) return true;
      if (typeof next === 'string') {
        const normalizedNext = next.trim();
        const normalizedCurrent = typeof current === 'string' ? current.trim() : current;
        return normalizedNext !== (normalizedCurrent ?? '');
      }
      return next !== current;
    });

    if (needsUpdate) {
      updates.push({ targetId: target.id, payload, deterministicId, groupedRows });
    }

    if (groupedRows.length > 1) {
      duplicates.push({ deterministicId, rows: groupedRows, canonicalId: target.id });
    }
  }

  console.log(`Rows requiring checkout_id update: ${updates.length}`);
  console.log(`Deterministic groups with duplicates: ${duplicates.length}`);
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} rows (missing data).`);
  }

  if (!apply) {
    console.log('\nDry run (no changes applied).');
    for (const update of updates) {
      console.log(`- Would update row ${update.targetId} -> checkout_id ${update.deterministicId}`);
    }
    if (duplicates.length) {
      console.log('\nDuplicate groups detected (review before deleting old rows):');
      for (const group of duplicates) {
        const ids = group.rows.map((row) => `${row.id} (${row.checkout_id})`).join(', ');
        console.log(`• ${group.deterministicId}: ${ids}`);
      }
    }
    if (skipped.length) {
      console.log('\nRows skipped due to missing email/product:');
      for (const entry of skipped) {
        console.log(`• ${entry.row.id} (checkout_id=${entry.row.checkout_id})`);
      }
    }
    console.log('\nRun again with --apply to persist the updates.');
    if (duplicates.length) {
      console.log('Add --delete-duplicates to remove non-canonical rows after the update.');
    }
    return;
  }

  console.log('\nApplying updates...');
  for (const update of updates) {
    const { targetId, payload, deterministicId } = update;
    const { error } = await client
      .from('abandoned_emails')
      .update(payload)
      .eq('id', targetId);
    if (error) {
      console.error(`Failed to update row ${targetId}:`, error);
      throw error;
    }
    console.log(`✔ Updated ${targetId} -> checkout_id ${deterministicId}`);
  }

  if (deleteDuplicates && duplicates.length) {
    console.log('\nDeleting non-canonical duplicates...');
    for (const group of duplicates) {
      const toDelete = group.rows.filter((row) => row.id !== group.canonicalId);
      for (const row of toDelete) {
        const { error } = await client
          .from('abandoned_emails')
          .delete()
          .eq('id', row.id);
        if (error) {
          console.error(`Failed to delete duplicate row ${row.id}:`, error);
          throw error;
        }
        console.log(`✖ Deleted duplicate ${row.id} (old checkout_id ${row.checkout_id})`);
      }
    }
  }

  console.log('\nBackfill completed successfully.');
  console.log(`Updated rows: ${updates.length}`);
  if (deleteDuplicates && duplicates.length) {
    const deleted = duplicates.reduce(
      (acc, group) => acc + group.rows.filter((row) => row.id !== group.canonicalId).length,
      0
    );
    console.log(`Deleted duplicates: ${deleted}`);
  }
  if (skipped.length) {
    console.log(`Rows still requiring manual review: ${skipped.length}`);
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
