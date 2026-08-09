import { calculateProspectScore } from './prospectScoring'
import type { SearchTarget } from './searchTargeting'
import type { QueryVariantPerformance } from './discoveryVariants'
import type { CatalogCoverage } from './catalogCoverage'

export type YouTubeDiscoveryCatalog = {
  version: string
  collectedAt: string
  channels: any[]
  queryVariantsUsed: string[]
  nextPageToken: string | null
  nextPageQuery?: string | null
  negativeRanges?: Record<string, string>
  rawVideoResults?: number
  completeness?: 'poor' | 'partial' | 'complete'
  variantPerformance?: Record<string, QueryVariantPerformance>
  coverage?: CatalogCoverage
  newlyDiscoveredThisRun?: number
  alreadyKnownThisRun?: number
  duplicateVideoResults?: number
  lastEnrichmentAt?: string
  enrichmentCount?: number
}

export function mergeCatalogChannels(existing: any[], discovered: any[]): any[] {
  const channels = new Map<string, any>()
  for (const channel of [...existing, ...discovered]) {
    if (typeof channel?.id === 'string' && channel.id) channels.set(channel.id, channel)
  }
  return Array.from(channels.values())
}

export function filterYouTubeCatalog(
  catalog: Pick<YouTubeDiscoveryCatalog, 'channels'>,
  subsMin: number,
  subsMax: number,
  maxResults: number,
  target?: SearchTarget
) {
  const qualified = catalog.channels
    .map(channel => {
      if (!target || !Array.isArray(channel.recentVideos)) return channel
      const scoreData = calculateProspectScore({ videos: channel.recentVideos, target, subscribers: Number(channel.subsNum || 0) })
      return {
        ...channel,
        score: scoreData.score,
        scoreLabel: scoreData.label,
        scoreBreakdown: scoreData.scoreBreakdown,
        contentRelevance: scoreData.relevance.score,
        subnicheMatch: scoreData.relevance.subnicheScore,
        subnicheMatchLabel: scoreData.relevance.subnicheLabel,
        editingPotential: scoreData.editingPotential.value,
        editingPotentialLabel: scoreData.editingPotential.label,
        scoreConfidence: scoreData.confidence,
        publishingFrequency: scoreData.frequency,
        activityStatus: scoreData.activity.status,
        activityLabel: scoreData.activity.label,
        videosLast30Days: scoreData.activity.videosLast30Days,
        videosLast90Days: scoreData.activity.videosLast90Days,
        medianPublishIntervalDays: scoreData.activity.medianPublishIntervalDays,
        lastPublishedAt: scoreData.activity.lastPublishedAt,
      }
    })
    .filter(channel => Number.isFinite(Number(channel?.subsNum)) && channel.subsNum >= subsMin && channel.subsNum <= subsMax)
    .filter(channel => channel.activityStatus !== 'INACTIVE')
    .filter(channel => !target || Number(channel.contentRelevance || 0) >= 10)
  const hasSpecificTarget = Boolean(target && (target.subNiches.length || target.customKeyword))
  const strict = hasSpecificTarget ? qualified.filter(channel => Number(channel.subnicheMatch || 0) >= 25) : qualified
  const nearby = qualified.filter(channel => !strict.some(strictChannel => strictChannel.id === channel.id)).map(channel => ({
    ...channel,
    matchMode: 'nearby',
    matchNotice: 'Resultat proche : la sous-categorie exacte est peu documentee dans les videos recentes.',
  }))
  const selected = hasSpecificTarget ? [...strict, ...nearby] : strict
  return selected.sort((a, b) => {
    const matchDifference = Number(a.matchMode === 'nearby') - Number(b.matchMode === 'nearby')
    return matchDifference || Number(b.score || 0) - Number(a.score || 0)
  }).slice(0, maxResults)
}
