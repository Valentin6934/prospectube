const LANGUAGE_CODES: Record<string, string> = {
  fr: 'fr',
  francais: 'fr',
  anglais: 'en',
  english: 'en',
  en: 'en',
  espagnol: 'es',
  espanol: 'es',
  spanish: 'es',
  es: 'es',
  allemand: 'de',
  deutsch: 'de',
  german: 'de',
  de: 'de',
  italien: 'it',
  italiano: 'it',
  italian: 'it',
  it: 'it',
  portugais: 'pt',
  portugues: 'pt',
  portuguese: 'pt',
  pt: 'pt',
}

const LANGUAGE_QUERY_SUFFIXES: Record<string, string> = {
  fr: 'français',
  en: 'english',
  es: 'español',
  de: 'deutsch',
  it: 'italiano',
  pt: 'português',
}

export const MAX_SEARCH_LIST_CALLS = 3
export const MAX_YOUTUBE_SEARCH_QUERIES = MAX_SEARCH_LIST_CALLS

function normalizeLanguageLabel(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function normalizeYouTubeLanguage(value: unknown): string | null {
  const normalized = normalizeLanguageLabel(value)
  return normalized ? LANGUAGE_CODES[normalized] || null : null
}

function normalizeQueryComparison(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function buildYouTubeQueryVariants(niche: unknown, language: unknown, alternatives?: unknown): string[] {
  const base = String(niche || '').trim().replace(/\s+/g, ' ')
  if (!base) return []

  const variants: string[] = []
  const languageCode = normalizeYouTubeLanguage(language)
  const suffix = languageCode ? LANGUAGE_QUERY_SUFFIXES[languageCode] : null

  const withLanguage = (value: string) => {
    if (!suffix || normalizeQueryComparison(value).includes(normalizeQueryComparison(suffix))) return value
    return `${value} ${suffix}`
  }
  variants.push(withLanguage(base))
  const alternateValues = (Array.isArray(alternatives) ? alternatives : [alternatives])
    .map(value => String(value || '').trim().replace(/\s+/g, ' ')).filter(Boolean)
  for (const alternate of alternateValues) variants.push(withLanguage(alternate))
  if (!alternateValues.length && suffix && !normalizeQueryComparison(base).includes(normalizeQueryComparison(suffix))) variants.push(`${base} video ${suffix}`)

  return Array.from(new Set(variants.map(value => value.trim()).filter(Boolean))).slice(0, MAX_YOUTUBE_SEARCH_QUERIES)
}

export function shouldRunNextYouTubeQuery(input: {
  queriesUsed: number
  totalVariants: number
}): boolean {
  return input.queriesUsed < Math.min(input.totalVariants, MAX_SEARCH_LIST_CALLS)
}

export function collectNewYouTubeChannelIds(items: any[], knownIds: Set<string>): string[] {
  const newIds: string[] = []
  for (const item of items || []) {
    const id = typeof item?.snippet?.channelId === 'string' ? item.snippet.channelId : ''
    if (!id || knownIds.has(id)) continue
    knownIds.add(id)
    newIds.push(id)
  }
  return newIds
}

export function analyzeYouTubeChannelRange(channels: any[], subsMin: number, subsMax: number) {
  const accepted: any[] = []
  let hiddenSubscribers = 0
  let belowMinimum = 0
  let aboveMaximum = 0

  for (const channel of channels) {
    const subscriberValue = channel?.statistics?.subscriberCount
    if (channel?.statistics?.hiddenSubscriberCount === true || subscriberValue === undefined || subscriberValue === null) {
      hiddenSubscribers += 1
      continue
    }
    const subscribers = Number(subscriberValue)
    if (!Number.isFinite(subscribers)) {
      hiddenSubscribers += 1
    } else if (subscribers < subsMin) {
      belowMinimum += 1
    } else if (subscribers > subsMax) {
      aboveMaximum += 1
    } else {
      accepted.push(channel)
    }
  }

  return { accepted, hiddenSubscribers, belowMinimum, aboveMaximum }
}

export function buildYouTubeSearchParams(input: {
  query: string
  language?: string | null
  maxResults?: number
  pageToken?: string | null
  fields: string
  type?: 'channel' | 'video'
  order?: 'relevance' | 'date' | 'viewCount'
}): URLSearchParams {
  const query = String(input.query || '').trim()
  const maxResults = input.maxResults ?? 50

  if (!query) throw new Error('YOUTUBE_SEARCH_QUERY_REQUIRED')
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 50) {
    throw new Error('YOUTUBE_SEARCH_MAX_RESULTS_INVALID')
  }

  const params = new URLSearchParams()
  params.set('part', 'snippet')
  params.set('type', input.type || 'channel')
  params.set('q', query)
  params.set('maxResults', String(maxResults))
  params.set('order', input.order || 'relevance')
  params.set('fields', input.fields)

  const relevanceLanguage = normalizeYouTubeLanguage(input.language)
  if (relevanceLanguage) params.set('relevanceLanguage', relevanceLanguage)
  if (input.pageToken) params.set('pageToken', input.pageToken)

  return params
}

export function getSafeYouTubeSearchParamsLog(params: URLSearchParams) {
  return {
    parameterNames: Array.from(params.keys()).filter(name => name !== 'key').sort(),
    type: params.get('type'),
    maxResults: Number(params.get('maxResults')),
    queryLength: params.get('q')?.length || 0,
    relevanceLanguage: params.get('relevanceLanguage'),
    hasRegionCode: params.has('regionCode'),
  }
}
