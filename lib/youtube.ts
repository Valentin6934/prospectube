import { selectDiverseProspectPreview } from '@/lib/freePreview'
import { PROSPECT_SCORE_THRESHOLDS } from '@/lib/prospectScoreInfo'
import { SEARCH_CACHE_VERSION } from '@/lib/searchPolicy'
import { calculateProspectScore, getContactability, scoreChannelContentRelevance, type RecentVideo } from '@/lib/prospectScoring'
import { getPrimarySearchFocus, getSearchFocusVariants, type SearchTarget } from '@/lib/searchTargeting'
import { YouTubeApiError, classifyYouTubeError } from '@/lib/youtubeQuota'
import { filterYouTubeCatalog, mergeCatalogChannels, YouTubeDiscoveryCatalog } from '@/lib/youtubeCatalog'
import {
  analyzeYouTubeChannelRange,
  buildYouTubeQueryVariants,
  buildYouTubeSearchParams,
  collectNewYouTubeChannelIds,
  MAX_YOUTUBE_SEARCH_QUERIES,
  shouldRunNextYouTubeQuery,
} from '@/lib/youtubeSearchParams'

const YOUTUBE_REQUEST_TIMEOUT_MS = 12_000
const YOUTUBE_SEARCH_FIELDS = 'items(id/videoId,snippet(channelId,title,description,publishedAt,thumbnails/default/url)),nextPageToken'
const YOUTUBE_CHANNEL_FIELDS = 'items(id,snippet(title,description,publishedAt,thumbnails/default/url),statistics(hiddenSubscriberCount,subscriberCount,viewCount,videoCount),brandingSettings/channel/description)'
const YOUTUBE_VIDEO_FIELDS = 'items(id,snippet(channelId,title,description,publishedAt,categoryId,defaultLanguage),statistics(viewCount,likeCount,commentCount),contentDetails/duration)'

async function fetchYouTubeJson(url: URL, endpoint: 'search.list' | 'channels.list' | 'videos.list', idCount = 0) {
  const startedAt = Date.now()
  let status = 0
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), YOUTUBE_REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(url.toString(), { signal: controller.signal })
    status = res.status
    const data = await res.json().catch(() => ({}))
    const durationMs = Date.now() - startedAt

    if (!res.ok || data.error) {
      const error = classifyYouTubeError({
        payload: data,
        status: res.status,
        endpoint,
        headers: res.headers,
        expectedProjectNumber: process.env.YOUTUBE_EXPECTED_PROJECT_NUMBER,
        fallbackMessage: `${endpoint} a echoue.`,
      })
      console.warn('YouTube API call failed:', {
        endpoint,
        idCount,
        status,
        reason: error.reason,
        code: error.code,
        durationMs,
      })
      throw error
    }

    console.info('YouTube API call completed:', {
      endpoint,
      idCount,
      status,
      durationMs,
    })

    return data
  } catch (error) {
    if (error instanceof YouTubeApiError) throw error
    const timedOut = error instanceof Error && error.name === 'AbortError'
    const classified = classifyYouTubeError({
      status: status || 500,
      endpoint,
      expectedProjectNumber: process.env.YOUTUBE_EXPECTED_PROJECT_NUMBER,
      timedOut,
      fallbackMessage: error instanceof Error ? error.message : `${endpoint} a echoue.`,
    })
    console.warn('YouTube API call failed:', {
      endpoint,
      idCount,
      status,
      reason: classified.reason,
      code: classified.code,
      durationMs: Date.now() - startedAt,
    })
    throw classified
  } finally {
    clearTimeout(timeout)
  }
}

function formatSubs(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(n)
}

function formatCompactNumber(n: number): string {
  if (n >= 1000000000) return `${(n / 1000000000).toFixed(1).replace('.0', '')}B`
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`
  return String(n)
}

function decodeHtml(text: string): string {
  return text
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function extractEmail(text: string): string | null {
  const decoded = decodeHtml(text)
  const match = decoded.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : null
}

function normalizeUrl(url: string | null): string | null {
  if (!url) return null
  const cleaned = url.replace(/\\u0026/g, '&').replace(/&amp;/g, '&')
  return cleaned.startsWith('http') ? cleaned : `https://${cleaned}`
}

function extractSocialLinks(text: string) {
  const decoded = decodeHtml(text)

  const instagram =
    decoded.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/[A-Za-z0-9._-]+/i)?.[0] || null

  const tiktok =
    decoded.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[A-Za-z0-9._-]+/i)?.[0] || null

  const twitch =
    decoded.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/[A-Za-z0-9_]+/i)?.[0] || null

  const website =
    decoded.match(/https?:\/\/(?!.*(?:instagram|tiktok|twitch|youtube|youtu\.be|facebook|twitter|x\.com|google))[^\s"'<>)}]+/i)?.[0] ||
    null

  return {
    instagram: normalizeUrl(instagram),
    tiktok: normalizeUrl(tiktok),
    twitch: normalizeUrl(twitch),
    website: normalizeUrl(website),
  }
}

export type YouTubeCallMetrics = {
  searchList: number
  channelsList: number
  aboutPages: number
  searchQueriesUsed: number
  rawCandidates: number
  uniqueCandidates: number
  hiddenSubscribers: number
  belowMinimum: number
  aboveMaximum: number
  acceptedResults: number
  videosList: number
  rejectedLanguage: number
  rejectedNiche: number
}

export type { YouTubeDiscoveryCatalog } from '@/lib/youtubeCatalog'
export { filterYouTubeCatalog } from '@/lib/youtubeCatalog'

function getChannelAge(publishedAt: string | null): number | null {
  if (!publishedAt) return null
  const created = new Date(publishedAt)
  if (Number.isNaN(created.getTime())) return null
  return Math.max(0, (Date.now() - created.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

function getAdvancedScoreColor(score: number): string {
  if (score >= PROSPECT_SCORE_THRESHOLDS.excellent) return 'green'
  if (score >= PROSPECT_SCORE_THRESHOLDS.good) return 'yellow'
  if (score >= PROSPECT_SCORE_THRESHOLDS.medium) return 'orange'
  return 'red'
}

export async function discoverYouTubeCatalog(
  niche: string,
  lang: string,
  subsMin: number,
  subsMax: number,
  metrics?: YouTubeCallMetrics,
  existingCatalog?: YouTubeDiscoveryCatalog | null,
  target?: SearchTarget
) {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey || !/^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey.trim())) {
    throw new YouTubeApiError(
      'YOUTUBE_KEY_INVALID',
      'Configuration YouTube invalide.',
      { status: 503, endpoint: 'configuration' }
    )
  }

  const queries = buildYouTubeQueryVariants(
    target ? getPrimarySearchFocus(target) : niche,
    lang,
    target ? getSearchFocusVariants(target) : null
  ).slice(0, MAX_YOUTUBE_SEARCH_QUERIES)
  const knownChannelIds = new Set<string>((existingCatalog?.channels || []).map(channel => channel.id).filter(Boolean))
  const channelsById = new Map<string, any>()
  const videoIds = new Set<string>()
  const videosByChannel = new Map<string, RecentVideo[]>()
  const catalogChannelsById = new Map<string, any>((existingCatalog?.channels || []).map(channel => [channel.id, channel]))
  const queryVariantsUsed = [...(existingCatalog?.queryVariantsUsed || [])]
  const unusedVariant = queries.find(query => !existingCatalog?.queryVariantsUsed.includes(query))
  const queriesToRun = existingCatalog
    ? [{
        query: existingCatalog.nextPageToken ? existingCatalog.nextPageQuery || queries[0] : unusedVariant,
        pageToken: existingCatalog.nextPageToken,
      }]
    : queries.map(query => ({ query, pageToken: null as string | null }))
  let nextPageToken: string | null = existingCatalog?.nextPageToken || null
  let nextPageQuery: string | null = existingCatalog?.nextPageQuery || null

  for (const queryInput of queriesToRun) {
    const query = queryInput.query
    if (!query) continue
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
    const searchParams = buildYouTubeSearchParams({
      query,
      language: lang,
      maxResults: 50,
      fields: YOUTUBE_SEARCH_FIELDS,
      pageToken: queryInput.pageToken,
      type: 'video',
    })
    searchUrl.search = searchParams.toString()
    searchUrl.searchParams.set('key', apiKey)

    if (metrics) {
      metrics.searchList += 1
      metrics.searchQueriesUsed += 1
    }
    const searchData = await fetchYouTubeJson(searchUrl, 'search.list')
    nextPageToken = typeof searchData.nextPageToken === 'string' ? searchData.nextPageToken : null
    nextPageQuery = nextPageToken ? query : null
    if (!queryVariantsUsed.includes(query)) queryVariantsUsed.push(query)
    const searchItems = Array.isArray(searchData.items) ? searchData.items : []
    for (const item of searchItems) {
      const videoId = item?.id?.videoId
      const channelId = item?.snippet?.channelId
      if (typeof videoId === 'string') videoIds.add(videoId)
      if (typeof channelId === 'string') {
        const samples = videosByChannel.get(channelId) || []
        samples.push({ title: item.snippet?.title, description: item.snippet?.description, publishedAt: item.snippet?.publishedAt })
        videosByChannel.set(channelId, samples)
      }
    }
    if (metrics) metrics.rawCandidates += searchItems.length
    const newChannelIds = collectNewYouTubeChannelIds(searchItems, knownChannelIds)
    if (metrics) metrics.uniqueCandidates = knownChannelIds.size

    for (let i = 0; i < newChannelIds.length; i += 50) {
      const batchIds = newChannelIds.slice(i, i + 50)
      const channelsUrl = new URL('https://www.googleapis.com/youtube/v3/channels')
      channelsUrl.searchParams.set('part', 'snippet,statistics,brandingSettings')
      channelsUrl.searchParams.set('id', batchIds.join(','))
      channelsUrl.searchParams.set('fields', YOUTUBE_CHANNEL_FIELDS)
      channelsUrl.searchParams.set('key', apiKey)

      if (metrics) metrics.channelsList += 1
      const channelsData = await fetchYouTubeJson(channelsUrl, 'channels.list', batchIds.length)
      for (const channel of channelsData.items || []) {
        if (channel?.id) channelsById.set(channel.id, channel)
      }
    }

    const discoveredChannels = Array.from(channelsById.values())
    const existingRangeChannels = Array.from(catalogChannelsById.values()).map(channel => ({
      id: channel.id,
      statistics: { subscriberCount: channel.subsNum, hiddenSubscriberCount: false },
    }))
    const currentRange = analyzeYouTubeChannelRange([...existingRangeChannels, ...discoveredChannels], subsMin, subsMax)
    const validTargetedResults = target
      ? currentRange.accepted.filter(channel => scoreChannelContentRelevance(videosByChannel.get(channel.id) || [], target).subnicheScore >= 25).length
      : currentRange.accepted.length
    if (!shouldRunNextYouTubeQuery({
      acceptedResults: validTargetedResults,
      queriesUsed: metrics?.searchQueriesUsed || queries.indexOf(query) + 1,
      totalVariants: queriesToRun.length,
    })) break
  }

  const allVideoIds = Array.from(videoIds)
  for (let i = 0; i < allVideoIds.length; i += 50) {
    const batchIds = allVideoIds.slice(i, i + 50)
    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
    videosUrl.searchParams.set('part', 'snippet,statistics,contentDetails')
    videosUrl.searchParams.set('id', batchIds.join(','))
    videosUrl.searchParams.set('fields', YOUTUBE_VIDEO_FIELDS)
    videosUrl.searchParams.set('key', apiKey)
    if (metrics) metrics.videosList += 1
    const data = await fetchYouTubeJson(videosUrl, 'videos.list', batchIds.length)
    for (const video of data.items || []) {
      const channelId = video?.snippet?.channelId
      if (!channelId) continue
      const sample = videosByChannel.get(channelId) || []
      const existingIndex = sample.findIndex(item => item.title === video.snippet?.title)
      const duration = String(video.contentDetails?.duration || '')
      const durationMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
      const durationSeconds = durationMatch
        ? Number(durationMatch[1] || 0) * 3600 + Number(durationMatch[2] || 0) * 60 + Number(durationMatch[3] || 0)
        : 0
      const normalized = { ...video.snippet, viewCount: Number(video.statistics?.viewCount || 0), likeCount: video.statistics?.likeCount === undefined ? undefined : Number(video.statistics.likeCount), commentCount: video.statistics?.commentCount === undefined ? undefined : Number(video.statistics.commentCount), durationSeconds }
      if (existingIndex >= 0) sample[existingIndex] = normalized
      else sample.push(normalized)
      videosByChannel.set(channelId, sample)
    }
  }

  const range = analyzeYouTubeChannelRange(Array.from(channelsById.values()), subsMin, subsMax)
  if (metrics) {
    metrics.hiddenSubscribers = range.hiddenSubscribers
    metrics.belowMinimum = range.belowMinimum
    metrics.aboveMaximum = range.aboveMaximum
  }
  const scoredCandidates = Array.from(channelsById.values())
    .map((ch: any) => {
      const subsNum = Number(ch.statistics?.subscriberCount || 0)
      const viewCount = Number(ch.statistics?.viewCount || 0)
      const totalViews = viewCount
      const videoCount = Number(ch.statistics?.videoCount || 0)
      const publishedAt = ch.snippet?.publishedAt || null
      const createdAt = publishedAt
      const channelAge = getChannelAge(publishedAt)
      const viewsPerSubscriber = subsNum > 0 ? viewCount / subsNum : 0
      const recentVideos = videosByChannel.get(ch.id) || []
      const snippetDesc = ch.snippet?.description || ''
      const brandingDesc = ch.brandingSettings?.channel?.description || ''
      const fullDesc = `${snippetDesc}\n${brandingDesc}`
      const desc = (fullDesc || 'Pas de description disponible.').slice(0, 160)
      const email = extractEmail(fullDesc)
      const socials = extractSocialLinks(fullDesc)

      const channel = {
        id: ch.id,
        name: ch.snippet?.title || 'Chaîne inconnue',
        subs: formatSubs(subsNum),
        subsNum,
        viewCount,
        totalViews,
        totalViewsFormatted: formatCompactNumber(totalViews),
        videoCount,
        videoCountFormatted: formatCompactNumber(videoCount),
        publishedAt,
        createdAt,
        channelAge,
        viewsPerSubscriber,
        recentVideos,
        discoverySource: 'targeted-video-search',
        sourceVideoCount: recentVideos.length,
        niche,
        lang,
        freq: 'Inconnu',
        email,
        instagram: socials.instagram,
        tiktok: socials.tiktok,
        twitch: socials.twitch,
        website: socials.website,
        channelUrl: `https://www.youtube.com/channel/${ch.id}`,
        aboutUrl: `https://www.youtube.com/channel/${ch.id}/about`,
        desc,
        avatar: (ch.snippet?.title || 'YT').slice(0, 2).toUpperCase(),
        color: '#533AB7',
        thumbnail: ch.snippet?.thumbnails?.default?.url || null,
      }

      const scoreData = calculateProspectScore({ videos: recentVideos, target: target || { niche, subNiches: [], customKeyword: '', language: lang }, subscribers: subsNum })
      const contactability = getContactability(channel)

      return {
        ...channel,
        score: scoreData.score,
        scoreLabel: scoreData.label,
        scoreColor: getAdvancedScoreColor(scoreData.score),
        scoreReason: `${scoreData.relevance.relevantCount}/${scoreData.relevance.sampleSize} videos correspondent au ciblage • ${scoreData.frequency}`,
        scoreBreakdown: scoreData.scoreBreakdown,
        contentRelevance: scoreData.relevance.score,
        subnicheMatch: scoreData.relevance.subnicheScore,
        subnicheMatchLabel: scoreData.relevance.subnicheLabel,
        detectedLanguage: scoreData.language.language,
        languageConfidence: scoreData.language.confidence,
        recentMedianViews: scoreData.medianViews,
        recentViewSubscriberRatio: scoreData.recentViewSubscriberRatio,
        recentEngagementRate: scoreData.engagementRate,
        publishingFrequency: scoreData.frequency,
        lastPublishedAt: scoreData.lastPublishedAt,
        contactability: contactability.level,
        editingPotential: scoreData.editingPotential.value,
        editingPotentialLabel: scoreData.editingPotential.label,
        scoreConfidence: scoreData.confidence,
      }
    })
  const expectedLanguage = ({ Français: 'fr', Anglais: 'en', Espagnol: 'es', Allemand: 'de', Italien: 'it', Portugais: 'pt' } as Record<string, string>)[lang]
  const candidates = scoredCandidates
    .filter((ch: any) => {
      if (ch.contentRelevance < 10) {
        if (metrics) metrics.rejectedNiche += 1
        return false
      }
      if (ch.languageConfidence === 'Élevée' && ch.detectedLanguage && ch.detectedLanguage !== expectedLanguage) {
        if (metrics) metrics.rejectedLanguage += 1
        return false
      }
      return true
    })
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 150)

  const finalResults = candidates
    .sort((a: any, b: any) => b.score - a.score)

  const channels = mergeCatalogChannels(Array.from(catalogChannelsById.values()), finalResults)
  if (metrics) metrics.acceptedResults = channels.filter(channel => channel.subsNum >= subsMin && channel.subsNum <= subsMax).length
  return {
    version: SEARCH_CACHE_VERSION,
    collectedAt: new Date().toISOString(),
    channels,
    queryVariantsUsed,
    nextPageToken,
    nextPageQuery,
    negativeRanges: existingCatalog?.negativeRanges,
    rawVideoResults: (existingCatalog?.rawVideoResults || 0) + (metrics?.rawCandidates || 0),
    completeness: metrics && metrics.acceptedResults >= 20 ? 'complete' : metrics && metrics.acceptedResults >= 10 ? 'partial' : 'poor',
  } satisfies YouTubeDiscoveryCatalog
}

export async function searchYouTubeChannels(
  niche: string,
  lang: string,
  subsMin: number,
  subsMax: number,
  maxResults: number,
  metrics?: YouTubeCallMetrics
) {
  const catalog = await discoverYouTubeCatalog(niche, lang, subsMin, subsMax, metrics)
  const results = filterYouTubeCatalog(catalog, subsMin, subsMax, Math.max(maxResults * 3, maxResults))
  if (maxResults <= 3) return selectDiverseProspectPreview(results, maxResults)
  return results.slice(0, maxResults)
}
