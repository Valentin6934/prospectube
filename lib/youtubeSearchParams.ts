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

export function buildYouTubeSearchParams(input: {
  query: string
  language?: string | null
  maxResults?: number
  pageToken?: string | null
  fields: string
}): URLSearchParams {
  const query = String(input.query || '').trim()
  const maxResults = input.maxResults ?? 50

  if (!query) throw new Error('YOUTUBE_SEARCH_QUERY_REQUIRED')
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 50) {
    throw new Error('YOUTUBE_SEARCH_MAX_RESULTS_INVALID')
  }

  const params = new URLSearchParams()
  params.set('part', 'snippet')
  params.set('type', 'channel')
  params.set('q', query)
  params.set('maxResults', String(maxResults))
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
