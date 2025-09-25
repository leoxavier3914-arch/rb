#!/usr/bin/env node
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

function normalizeProductComponent(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeEmailForMatch(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStatusForMatch(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

async function loadDuplicatesByEmail({ supabase, emailVariants, columns }) {
  const related = [];
  const seen = new Set();

  for (const variant of emailVariants) {
    for (const column of columns) {
      const { data, error } = await supabase
        .from('abandoned_emails')
        .select(
          'id, checkout_id, paid, status, paid_at, last_event, product_id, product_title, created_at, updated_at'
        )
        .eq(column, variant)
        .limit(200);

      if (error) {
        console.warn('[backfill] failed to load duplicates by email', error, { column });
        continue;
      }

      for (const row of ensureArray(data)) {
        if (!row || typeof row.id !== 'string') continue;
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        related.push(row);
      }
    }
  }

  return related;
}

async function loadDuplicatesByCheckout({ supabase, checkoutIds }) {
  if (!checkoutIds.length) return [];

  const { data, error } = await supabase
    .from('abandoned_emails')
    .select(
      'id, checkout_id, paid, status, paid_at, last_event, product_id, product_title, created_at, updated_at'
    )
    .in('checkout_id', checkoutIds);

  if (error) {
    console.warn('[backfill] failed to load duplicates by checkout_id', error, {
      checkoutIdCount: checkoutIds.length,
    });
    return [];
  }

  return ensureArray(data);
}

function collectEmailVariants(row) {
  const variants = new Set();
  const candidates = [row.customer_email, row.email];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      const trimmed = candidate.trim();
      variants.add(trimmed);
      const normalized = normalizeEmailForMatch(trimmed);
      if (normalized) {
        variants.add(normalized);
      }
    }
  }
  return Array.from(variants);
}

function collectCheckoutIds(row) {
  const ids = new Set();
  if (typeof row.checkout_id === 'string') {
    const trimmed = row.checkout_id.trim();
    if (trimmed) {
      ids.add(trimmed);
    }
  }
  return ids;
}

function matchesProduct({
  candidate,
  candidateIdSet,
  targetProductId,
  targetProductTitle,
}) {
  const candidateId = normalizeProductComponent(candidate.product_id);
  const candidateTitle = normalizeProductComponent(candidate.product_title);

  if (
    typeof candidate.checkout_id === 'string' &&
    candidateIdSet.has(candidate.checkout_id.trim())
  ) {
    return true;
  }

  if (targetProductId && candidateId) {
    return targetProductId === candidateId;
  }

  if (!targetProductId && targetProductTitle && candidateTitle) {
    return targetProductTitle === candidateTitle;
  }

  return false;
}

function needsUpdate(candidate) {
  const normalizedStatus = normalizeStatusForMatch(candidate.status);
  const alreadyConverted = Boolean(candidate.paid) && normalizedStatus === 'converted';
  const hasPaidAt = Boolean(candidate.paid_at);
  return !(alreadyConverted && hasPaidAt);
}

function resolvePaidAt(preferred, fallback) {
  if (preferred) return preferred;
  if (fallback.paid_at) return fallback.paid_at;
  if (fallback.updated_at) return fallback.updated_at;
  if (fallback.created_at) return fallback.created_at;
  return null;
}

async function propagateForRow({ supabase, row }) {
  const normalizedStatus = normalizeStatusForMatch(row.status);
  const isConverted = Boolean(row.paid) || normalizedStatus === 'converted';
  if (!isConverted) {
    return { updated: 0 };
  }

  const emailVariants = collectEmailVariants(row);
  const checkoutIdSet = collectCheckoutIds(row);
  const checkoutIds = Array.from(checkoutIdSet);

  const targetProductId = normalizeProductComponent(row.product_id);
  const targetProductTitle = normalizeProductComponent(row.product_title);

  const relatedRaw = await loadDuplicatesByCheckout({ supabase, checkoutIds });
  const relatedByEmail = await loadDuplicatesByEmail({
    supabase,
    emailVariants,
    columns: ['customer_email', 'email'],
  });

  const related = [];
  const seen = new Set([row.id]);
  for (const entry of [...relatedRaw, ...relatedByEmail]) {
    if (!entry || typeof entry.id !== 'string') continue;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    related.push(entry);
  }

  if (!related.length) {
    return { updated: 0 };
  }

  const nowIso = new Date().toISOString();
  const updates = [];
  for (const candidate of related) {
    if (
      !matchesProduct({
        candidate,
        candidateIdSet: checkoutIdSet,
        targetProductId,
        targetProductTitle,
      })
    ) {
      continue;
    }
    if (!needsUpdate(candidate)) {
      continue;
    }

    updates.push({
      id: candidate.id,
      paid: true,
      status: 'converted',
      paid_at: resolvePaidAt(candidate.paid_at, row) ?? nowIso,
      last_event: candidate.last_event ?? row.last_event ?? null,
      updated_at: nowIso,
    });
  }

  if (!updates.length) {
    return { updated: 0 };
  }

  const { error } = await supabase.from('abandoned_emails').upsert(updates);
  if (error) {
    console.error('[backfill] failed to propagate converted status', error, {
      ids: updates.map((item) => item.id),
    });
    return { updated: 0, error: true };
  }

  return { updated: updates.length };
}

async function main() {
  const supabaseUrl = readEnv('SUPABASE_URL', ['NEXT_PUBLIC_SUPABASE_URL']);
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY', [
    'SUPABASE_SERVICE_ROLE',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_SECRET_KEY',
  ]);

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE.');
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const pageSize = 200;
  let from = 0;
  let processed = 0;
  let totalUpdates = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('abandoned_emails')
      .select(
        'id, checkout_id, customer_email, email, paid, status, paid_at, last_event, product_id, product_title, created_at, updated_at'
      )
      .or('paid.is.true,status.eq.converted')
      .order('updated_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('[backfill] failed to load base rows', error);
      process.exitCode = 1;
      return;
    }

    const rows = ensureArray(data);
    if (!rows.length) {
      break;
    }

    for (const row of rows) {
      if (!row || typeof row.id !== 'string') continue;
      const result = await propagateForRow({ supabase, row });
      processed += 1;
      totalUpdates += result.updated;
      if (result.updated > 0) {
        console.log('[backfill] propagated duplicates', {
          baseId: row.id,
          updates: result.updated,
        });
      }
    }

    if (rows.length < pageSize) {
      break;
    }
    from += rows.length;
  }

  console.log('[backfill] completed', { processed, totalUpdates });
}

await main();
