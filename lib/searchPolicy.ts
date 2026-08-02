export const FREE_LIFETIME_SEARCH_LIMIT = 1
export const PRO_DAILY_SEARCH_LIMIT = 5
export const SEARCH_CACHE_VERSION = 'youtube-search-v3'
export const SEARCH_CACHE_TTL_HOURS = 48
export const SEARCH_LOCK_TTL_MS = 2 * 60 * 1000

export type SearchPlan = 'Gratuit' | 'Pro'

export function normalizeSearchText(value: unknown): string {
  return String(value || 'all')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'all'
}

export function buildSearchCacheKey(input: {
  niche: string
  lang: string
  subsMin: number
  subsMax: number
}): string {
  const min = Math.max(0, Math.trunc(Number(input.subsMin) || 0))
  const max = Math.max(min, Math.trunc(Number(input.subsMax) || 0))
  return [
    SEARCH_CACHE_VERSION,
    normalizeSearchText(input.niche),
    normalizeSearchText(input.lang),
    min,
    max,
  ].join(':')
}

export function getUtcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function getUtcDayStart(date = new Date()): Date {
  return new Date(`${getUtcDayKey(date)}T00:00:00.000Z`)
}

export function getSearchLimit(plan: SearchPlan): number {
  return plan === 'Pro' ? PRO_DAILY_SEARCH_LIMIT : FREE_LIFETIME_SEARCH_LIMIT
}

export function getSearchQuotaMessage(plan: SearchPlan, remaining: number): string {
  if (plan === 'Pro') {
    return `${remaining} recherche(s) restante(s) aujourd'hui.`
  }
  return remaining > 0
    ? '1 recherche gratuite disponible sur votre compte.'
    : 'Votre recherche gratuite a ete utilisee. Passez au Plan Pro pour continuer.'
}
