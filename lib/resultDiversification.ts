import { createHash } from 'node:crypto'
import { normalizeSearchText, SEARCH_CACHE_VERSION } from './searchPolicy'
import type { SearchTarget } from './searchTargeting'

export function buildExposureTargetKey(target: SearchTarget, subsMin: number, subsMax: number): string {
  return [target.niche, target.language, ...target.subNiches.slice().sort(), target.customKeyword, subsMin, subsMax]
    .map(normalizeSearchText).join(':')
}

function deterministicUnit(seed: string, channelId: string): number {
  const value = createHash('sha256').update(`${seed}:${channelId}`).digest().readUInt32BE(0)
  return value / 0xffffffff
}

export function extractChannelIdsFromSearchResults(rows: Array<{ results: string }>): Set<string> {
  const ids = new Set<string>()
  for (const row of rows) {
    try {
      const results = JSON.parse(row.results)
      if (!Array.isArray(results)) continue
      for (const channel of results) {
        const id = typeof channel?.id === 'string' ? channel.id : typeof channel?.channelId === 'string' ? channel.channelId : ''
        if (id) ids.add(id)
      }
    } catch {}
  }
  return ids
}

export function countGlobalChannelExposure(rows: Array<{ results: string }>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    extractChannelIdsFromSearchResults([row]).forEach(id => counts.set(id, (counts.get(id) || 0) + 1))
  }
  return counts
}

export function diversifyProspects(input: {
  channels: any[]
  seenChannelIds: Set<string>
  campaignChannelIds: Set<string>
  globalExposure: Map<string, number>
  userSeed: string
  targetKey: string
  now?: Date
  limit: number
}) {
  const day = (input.now || new Date()).toISOString().slice(0, 10)
  const seed = createHash('sha256').update(`${input.userSeed}:${input.targetKey}:${day}:${SEARCH_CACHE_VERSION}`).digest('hex')
  const ranked = input.channels.map(channel => {
    const id = String(channel.id || channel.channelId || '')
    const seen = input.seenChannelIds.has(id)
    const inCampaign = input.campaignChannelIds.has(id)
    const quality = Number(channel.contentRelevance || 0) * 0.4 + Number(channel.subnicheMatch || 0) * 0.25 + Number(channel.score || 0) * 0.35
    const novelty = seen ? 0 : 15
    const exposure = Math.max(0, 10 - Math.min(10, input.globalExposure.get(id) || 0))
    const jitter = (deterministicUnit(seed, id) - 0.5) * 4
    return { ...channel, previouslySeen: seen, diversificationRank: quality * 0.75 + novelty + exposure + jitter - (inCampaign ? 20 : 0) }
  }).sort((a, b) => {
    const matchTier = Number(a.matchMode === 'nearby') - Number(b.matchMode === 'nearby')
    if (matchTier) return matchTier
    const relevanceGap = Number(b.contentRelevance || 0) - Number(a.contentRelevance || 0)
    if (Math.abs(relevanceGap) > 15) return relevanceGap
    return b.diversificationRank - a.diversificationRank
  })
  const results = ranked.slice(0, input.limit)
  const newCount = results.filter(channel => !channel.previouslySeen).length
  return { results, newCount, seenCount: results.length - newCount }
}
