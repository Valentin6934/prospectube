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
  maxResults: number
) {
  return catalog.channels
    .filter(channel => Number.isFinite(Number(channel?.subsNum)) && channel.subsNum >= subsMin && channel.subsNum <= subsMax)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, maxResults)
}
