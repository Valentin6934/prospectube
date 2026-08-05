import { calculateProspectScore } from './prospectScoring'
import type { SearchTarget } from './searchTargeting'

export type YouTubeDiscoveryCatalog = {
  version: string
  collectedAt: string
  channels: any[]
  queryVariantsUsed: string[]
  nextPageToken: string | null
  nextPageQuery?: string | null
  negativeRanges?: Record<string, string>
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
  filters: { emailOnly?: boolean; activeOnly?: boolean; minMedianViews?: number; minContentRelevance?: number } = {},
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
      }
    })
    .filter(channel => Number.isFinite(Number(channel?.subsNum)) && channel.subsNum >= subsMin && channel.subsNum <= subsMax)
    .filter(channel => !filters.emailOnly || Boolean(channel.email))
    .filter(channel => !filters.activeOnly || ['Très active', 'Active'].includes(channel.publishingFrequency))
    .filter(channel => Number(channel.recentMedianViews || 0) >= Number(filters.minMedianViews || 0))
    .filter(channel => Number(channel.contentRelevance || 0) >= Number(filters.minContentRelevance || 0))
  const hasSpecificTarget = Boolean(target && (target.subNiches.length || target.customKeyword))
  const strict = hasSpecificTarget ? qualified.filter(channel => Number(channel.subnicheMatch || 0) >= 25) : qualified
  const selected = strict.length ? strict : qualified.map(channel => ({
    ...channel,
    matchMode: 'nearby',
    matchNotice: 'Resultat proche : la sous-categorie exacte est peu documentee dans les videos recentes.',
  }))
  return selected.sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, maxResults)
}
