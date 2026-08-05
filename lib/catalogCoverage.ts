export type CatalogCoverage = {
  totalChannelsKnown: number
  totalStrictMatchesKnown: number
  totalNearbyMatchesKnown: number
  newlyDiscoveredThisRun: number
  alreadyKnownThisRun: number
  duplicateVideoResults: number
  uniqueChannelRate: number
  usersExposedCount: number
  channelsNeverShown: number
  channelsShownAtLeastOnce: number
  coverageRate: number
  lastEnrichmentAt: string
  enrichmentCount: number
}

export function calculateCatalogCoverage(input: {
  channels: any[]
  matchedChannels?: any[]
  globalExposure: Map<string, number>
  newlyDiscoveredThisRun?: number
  alreadyKnownThisRun?: number
  rawVideoResults?: number
  duplicateVideoResults?: number
  previous?: CatalogCoverage
  usersExposedCount?: number
  now?: Date
}): CatalogCoverage {
  const shown = input.channels.filter(channel => (input.globalExposure.get(String(channel.id || channel.channelId)) || 0) > 0).length
  const total = input.channels.length
  return {
    totalChannelsKnown: total,
    totalStrictMatchesKnown: (input.matchedChannels || input.channels).filter(channel => channel.matchMode !== 'nearby').length,
    totalNearbyMatchesKnown: (input.matchedChannels || input.channels).filter(channel => channel.matchMode === 'nearby').length,
    newlyDiscoveredThisRun: input.newlyDiscoveredThisRun || 0,
    alreadyKnownThisRun: input.alreadyKnownThisRun || 0,
    duplicateVideoResults: input.duplicateVideoResults || 0,
    uniqueChannelRate: input.rawVideoResults ? Number((total / input.rawVideoResults).toFixed(3)) : 0,
    usersExposedCount: input.usersExposedCount || 0,
    channelsNeverShown: total - shown,
    channelsShownAtLeastOnce: shown,
    coverageRate: total ? Number((shown / total).toFixed(3)) : 0,
    lastEnrichmentAt: (input.now || new Date()).toISOString(),
    enrichmentCount: (input.previous?.enrichmentCount || 0) + 1,
  }
}

export function getUserCoverage(channels: any[], seenChannelIds: Set<string>) {
  const alreadySeenByUser = channels.filter(channel => seenChannelIds.has(String(channel.id || channel.channelId))).length
  return { newForUser: channels.length - alreadySeenByUser, alreadySeenByUser, catalogRemainingForUser: channels.length - alreadySeenByUser }
}
