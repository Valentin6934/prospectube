export const FREE_LIFETIME_SEARCH_LIMIT = 1
export const PRO_DAILY_SEARCH_LIMIT = 5
export const SEARCH_CACHE_VERSION = 'youtube-search-v5'
export const SEARCH_CACHE_TTL_HOURS = 48
export const SEARCH_CATALOG_POOR_REFRESH_HOURS = 12
export const SEARCH_NEGATIVE_CACHE_TTL_HOURS = 1
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
}): string {
  return [
    SEARCH_CACHE_VERSION,
    normalizeSearchText(input.niche),
    normalizeSearchText(input.lang),
  ].join(':')
}

export function getCatalogAgeHours(collectedAt: unknown, now = new Date()): number {
  const collected = new Date(String(collectedAt || ''))
  if (Number.isNaN(collected.getTime())) return Number.POSITIVE_INFINITY
  return Math.max(0, (now.getTime() - collected.getTime()) / 3_600_000)
}

export function shouldEnrichSearchCatalog(input: {
  candidateCount: number
  filteredResultCount: number
  collectedAt: unknown
  now?: Date
}): boolean {
  return input.filteredResultCount < 10 &&
    input.candidateCount > 0 &&
    getCatalogAgeHours(input.collectedAt, input.now) >= SEARCH_CATALOG_POOR_REFRESH_HOURS
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
