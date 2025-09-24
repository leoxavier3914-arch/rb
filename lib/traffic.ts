export type TrafficCategory = 'organic' | 'tiktok' | 'other';

const ORGANIC_KEYWORDS = ['organico', 'orgânico', 'organic', 'seo'];
const TIKTOK_PAID_KEYWORDS = ['paid', 'ads'];

const ORGANIC_PLATFORM_KEYWORDS: { keyword: string; label: string }[] = [
  { keyword: 'tiktok', label: 'TikTok' },
  { keyword: 'facebook', label: 'Facebook' },
  { keyword: 'instagram', label: 'Instagram' },
];

type TrafficTokenMetadata = {
  label: string;
  priority: number;
};

const TRAFFIC_TOKEN_METADATA: Record<string, TrafficTokenMetadata> = {
  organic: { label: 'Orgânico', priority: 0 },
  org: { label: 'Orgânico', priority: 0 },
  paid: { label: 'Pago', priority: 0 },
  pag: { label: 'Pago', priority: 0 },
  email: { label: 'Email', priority: 2 },
  'manual-email': { label: 'Email Manual', priority: 2 },
  manual: { label: 'Manual', priority: 2 },
  referral: { label: 'Indicação', priority: 1 },
  social: { label: 'Social', priority: 1 },
  tiktok: { label: 'TikTok', priority: 1 },
  facebook: { label: 'Facebook', priority: 1 },
  instagram: { label: 'Instagram', priority: 1 },
  google: { label: 'Google', priority: 1 },
  bing: { label: 'Bing', priority: 1 },
  taboola: { label: 'Taboola', priority: 1 },
  kwai: { label: 'Kwai', priority: 1 },
  pinterest: { label: 'Pinterest', priority: 1 },
  snapchat: { label: 'Snapchat', priority: 1 },
  twitter: { label: 'Twitter', priority: 1 },
  linkedin: { label: 'LinkedIn', priority: 1 },
  youtube: { label: 'YouTube', priority: 1 },
  whatsapp: { label: 'WhatsApp', priority: 1 },
};

export function getTrafficCategory(source: string | null | undefined): TrafficCategory {
  if (!source) {
    return 'other';
  }

  const normalized = source.trim().toLowerCase();

  if (!normalized) {
    return 'other';
  }

  if (ORGANIC_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return 'organic';
  }

  if (normalized.includes('tiktok')) {
    const hasPaidIndicator = TIKTOK_PAID_KEYWORDS.some((keyword) =>
      normalized.includes(keyword),
    );

    return hasPaidIndicator ? 'tiktok' : 'organic';
  }

  return 'other';
}

export function getTrafficCategoryLabel(category: TrafficCategory): string {
  switch (category) {
    case 'organic':
      return 'Orgânico';
    case 'tiktok':
      return 'TikTok Ads';
    default:
      return 'Outros canais';
  }
}

function formatPlatformLabel(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) {
    return '';
  }

  const normalized = trimmed.toLowerCase();

  for (const { keyword, label } of ORGANIC_PLATFORM_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return label;
    }
  }

  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const ORGANIC_SEPARATOR_REGEX = /[\/\-|–—>]/;

export function getOrganicPlatformDetail(source: string | null | undefined): string | null {
  if (!source) {
    return null;
  }

  const normalized = source.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  for (const { keyword, label } of ORGANIC_PLATFORM_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return label;
    }
  }

  const segments = source
    .split(ORGANIC_SEPARATOR_REGEX)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const segmentNormalized = segment.toLowerCase();
    const isOrganic = ORGANIC_KEYWORDS.some((keyword) => segmentNormalized.includes(keyword));

    if (!isOrganic) {
      const label = formatPlatformLabel(segment);
      return label || null;
    }

    let cleaned = segment;

    for (const keyword of ORGANIC_KEYWORDS) {
      const keywordRegex = new RegExp(keyword, 'ig');
      cleaned = cleaned.replace(keywordRegex, '');
    }

    cleaned = cleaned.trim();

    if (cleaned) {
      const label = formatPlatformLabel(cleaned);
      if (label) {
        return label;
      }
    }
  }

  return null;
}

export function formatTrafficSourceLabel(source: string | null | undefined): string {
  const trimmed = typeof source === 'string' ? source.trim() : '';

  if (!trimmed || trimmed.toLowerCase() === 'unknown') {
    return 'Outros canais';
  }

  const segments = trimmed
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const seen = new Set<string>();
  const entries: Array<{ label: string; priority: number; index: number }> = [];

  const addSegment = (raw: string, index: number) => {
    const normalized = raw.trim().toLowerCase();
    if (!normalized || normalized === 'unknown' || seen.has(normalized)) {
      return;
    }

    const metadata = TRAFFIC_TOKEN_METADATA[normalized];
    if (metadata) {
      entries.push({ label: metadata.label, priority: metadata.priority, index });
      seen.add(normalized);
      return;
    }

    const label = formatPlatformLabel(raw);
    if (label) {
      entries.push({ label, priority: 1, index });
      seen.add(normalized);
    }
  };

  segments.forEach((segment, index) => addSegment(segment, index));

  if (!entries.length) {
    const fallback = formatPlatformLabel(trimmed);
    if (fallback) {
      return fallback;
    }

    return trimmed;
  }

  entries.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    return a.index - b.index;
  });

  return entries.map((entry) => entry.label).join(' / ');
}
