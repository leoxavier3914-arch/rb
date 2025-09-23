export type TrafficCategory = 'organic' | 'tiktok' | 'other';

const ORGANIC_KEYWORDS = ['organico', 'orgânico', 'organic', 'seo'];

const ORGANIC_PLATFORM_KEYWORDS: { keyword: string; label: string }[] = [
  { keyword: 'tiktok', label: 'TikTok' },
  { keyword: 'facebook', label: 'Facebook' },
  { keyword: 'instagram', label: 'Instagram' },
];

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
    return 'tiktok';
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
