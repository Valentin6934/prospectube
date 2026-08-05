export const FREE_LIFETIME_SEARCH_LIMIT = 3
export const FREE_SEARCH_QUOTA_VERSION = 1
export const FREE_SEARCH_PERIOD_KEY = `free-lifetime-v${FREE_SEARCH_QUOTA_VERSION}`
export const PRO_DAILY_SEARCH_LIMIT = 5
export const SEARCH_CACHE_VERSION = 'youtube-search-v6'
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
  subNiches?: string[]
  customKeyword?: string
}): string {
  return [
    SEARCH_CACHE_VERSION,
    normalizeSearchText(input.niche),
    normalizeSearchText(input.lang),
    normalizeSearchText((input.subNiches || []).slice().sort().join('-')),
    normalizeSearchText(input.customKeyword || ''),
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
    ? remaining === 1 ? '1 recherche gratuite restante.' : `${remaining} recherches gratuites restantes.`
    : 'Vous avez utilise vos 3 recherches gratuites. Passez au Plan Pro pour continuer.'
}
