import { createHash } from 'node:crypto'
import { normalizeTargetText, type SearchTarget } from './searchTargeting'
import { normalizeYouTubeLanguage } from './youtubeSearchParams'

export type QueryBreadth = 'strict' | 'format' | 'fallback'

export type DiscoveryVariant = {
  id: string
  query: string
  level: QueryBreadth
  terms: string[]
}

export type QueryVariantPerformance = {
  variantId: string
  level: QueryBreadth
  rawVideos: number
  uniqueChannels: number
  channelsAfterLanguage: number
  channelsAfterSubscribers: number
  strictMatches: number
  nearbyMatches: number
  duplicateVideos: number
  lastUsedAt: string
  uses: number
  yield: number
}

type DiscoveryConfig = {
  strictQueryTerms: string[]
  formatQueryTerms: string[]
  fallbackQueryTerms: string[]
  synonyms: string[]
  excludeTerms: string[]
}

const CONFIG: Record<string, DiscoveryConfig> = {
  fortnite: {
    strictQueryTerms: ['fortnite'],
    formatQueryTerms: ['gameplay fortnite'],
    fallbackQueryTerms: ['fortnite battle royale', 'createurs fortnite'],
    synonyms: ['battle royale', 'chapitre fortnite'],
    excludeTerms: ['fortnight'],
  },
  'mode homme': {
    strictQueryTerms: ['mode homme'],
    formatQueryTerms: ['style masculin'],
    fallbackQueryTerms: ['menswear', 'conseils vetements homme'],
    synonyms: ['look homme', 'tenue homme'],
    excludeTerms: ['mode femme'],
  },
}

const LANGUAGE_SUFFIXES: Record<string, string> = { fr: 'français', en: 'english', es: 'español', de: 'deutsch', it: 'italiano', pt: 'português' }

function variantId(level: QueryBreadth, query: string): string {
  return createHash('sha256').update(`${level}:${normalizeTargetText(query)}`).digest('hex').slice(0, 12)
}

export function getDiscoveryConfig(target: SearchTarget): DiscoveryConfig {
  const focus = normalizeTargetText(target.customKeyword || target.subNiches[0] || target.niche)
  return CONFIG[focus] || {
    strictQueryTerms: [focus],
    formatQueryTerms: [`${focus} video`],
    fallbackQueryTerms: [`createurs ${focus}`],
    synonyms: [],
    excludeTerms: [],
  }
}

export function classifyQueryBreadth(value: unknown): QueryBreadth {
  return value === 'format' || value === 'fallback' ? value : 'strict'
}

export function buildDiscoveryFallbackQueries(target: SearchTarget): DiscoveryVariant[] {
  const config = getDiscoveryConfig(target)
  const suffix = LANGUAGE_SUFFIXES[normalizeYouTubeLanguage(target.language) || ''] || ''
  const definitions: Array<[QueryBreadth, string]> = [
    ['strict', config.strictQueryTerms[0]],
    ['format', config.formatQueryTerms[0]],
    ...config.fallbackQueryTerms.map(term => ['fallback', term] as [QueryBreadth, string]),
  ]
  const seen = new Set<string>()
  return definitions.flatMap(([level, term]) => {
    const query = [term, level === 'fallback' ? '' : suffix].filter(Boolean).join(' ').trim()
    const normalized = normalizeTargetText(query)
    if (!normalized || seen.has(normalized)) return []
    seen.add(normalized)
    return [{ id: variantId(level, query), query, level, terms: [term, ...config.synonyms] }]
  })
}

export function calculateQueryVariantYield(input: Pick<QueryVariantPerformance, 'strictMatches' | 'nearbyMatches' | 'uniqueChannels' | 'duplicateVideos' | 'rawVideos'>): number {
  const base = input.strictMatches + 0.4 * input.nearbyMatches + 0.1 * input.uniqueChannels
  const uniqueRate = input.rawVideos > 0 ? input.uniqueChannels / input.rawVideos : 0
  return Number((base * (0.5 + 0.5 * uniqueRate)).toFixed(3))
}

export function rankQueryVariants(variants: DiscoveryVariant[], performance: Record<string, QueryVariantPerformance> = {}): DiscoveryVariant[] {
  return variants.slice().sort((a, b) => {
    const yieldDifference = (performance[b.id]?.yield ?? 0.1) - (performance[a.id]?.yield ?? 0.1)
    if (yieldDifference) return yieldDifference
    return ['strict', 'format', 'fallback'].indexOf(a.level) - ['strict', 'format', 'fallback'].indexOf(b.level)
  })
}

export function selectComplementaryVariant(variants: DiscoveryVariant[], selected: DiscoveryVariant[]): DiscoveryVariant | null {
  return variants.find(variant => !selected.some(item => item.id === variant.id) && !selected.some(item => item.level === variant.level))
    || variants.find(variant => !selected.some(item => item.id === variant.id)) || null
}

export function selectNextDiscoveryVariant(variants: DiscoveryVariant[], selected: DiscoveryVariant[], performance: Record<string, QueryVariantPerformance> = {}): DiscoveryVariant | null {
  return selectComplementaryVariant(rankQueryVariants(variants, performance), selected)
}

export function updateVariantPerformance(previous: QueryVariantPerformance | undefined, current: Omit<QueryVariantPerformance, 'uses' | 'yield'>): QueryVariantPerformance {
  const uses = (previous?.uses || 0) + 1
  const totals = {
    rawVideos: (previous?.rawVideos || 0) + current.rawVideos,
    uniqueChannels: (previous?.uniqueChannels || 0) + current.uniqueChannels,
    channelsAfterLanguage: (previous?.channelsAfterLanguage || 0) + current.channelsAfterLanguage,
    channelsAfterSubscribers: (previous?.channelsAfterSubscribers || 0) + current.channelsAfterSubscribers,
    strictMatches: (previous?.strictMatches || 0) + current.strictMatches,
    nearbyMatches: (previous?.nearbyMatches || 0) + current.nearbyMatches,
    duplicateVideos: (previous?.duplicateVideos || 0) + current.duplicateVideos,
  }
  return { ...current, ...totals, uses, yield: calculateQueryVariantYield(totals) }
}
