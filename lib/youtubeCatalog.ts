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
  filters: { emailOnly?: boolean; activeOnly?: boolean; minMedianViews?: number; minContentRelevance?: number } = {}
) {
  return catalog.channels
    .filter(channel => Number.isFinite(Number(channel?.subsNum)) && channel.subsNum >= subsMin && channel.subsNum <= subsMax)
    .filter(channel => !filters.emailOnly || Boolean(channel.email))
    .filter(channel => !filters.activeOnly || ['Très active', 'Active'].includes(channel.publishingFrequency))
    .filter(channel => Number(channel.recentMedianViews || 0) >= Number(filters.minMedianViews || 0))
    .filter(channel => Number(channel.contentRelevance || 0) >= Number(filters.minContentRelevance || 0))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, maxResults)
}
