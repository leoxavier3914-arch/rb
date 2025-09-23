export type TrafficCategory = 'organic' | 'tiktok' | 'other';

const ORGANIC_KEYWORDS = ['organico', 'orgânico', 'organic', 'seo'];

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
