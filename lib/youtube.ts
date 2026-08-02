import { selectDiverseProspectPreview } from '@/lib/freePreview'
import { PROSPECT_SCORE_THRESHOLDS } from '@/lib/prospectScoreInfo'
import { SEARCH_CACHE_VERSION } from '@/lib/searchPolicy'
import { YouTubeApiError, classifyYouTubeError } from '@/lib/youtubeQuota'
import { filterYouTubeCatalog, mergeCatalogChannels, YouTubeDiscoveryCatalog } from '@/lib/youtubeCatalog'
import {
  analyzeYouTubeChannelRange,
  buildYouTubeQueryVariants,
  buildYouTubeSearchParams,
  collectNewYouTubeChannelIds,
  getSafeYouTubeSearchParamsLog,
  MAX_YOUTUBE_SEARCH_QUERIES,
  shouldRunNextYouTubeQuery,
} from '@/lib/youtubeSearchParams'

const YOUTUBE_REQUEST_TIMEOUT_MS = 12_000
const YOUTUBE_SEARCH_FIELDS = 'items(snippet(channelId,title,description,thumbnails/default/url)),nextPageToken'
const YOUTUBE_CHANNEL_FIELDS = 'items(id,snippet(title,description,publishedAt,thumbnails/default/url),statistics(hiddenSubscriberCount,subscriberCount,viewCount,videoCount),brandingSettings/channel/description)'

async function fetchYouTubeJson(url: URL, endpoint: 'search.list' | 'channels.list', idCount = 0) {
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

function looksLikeLanguage(text: string, lang: string): boolean {
  const t = ` ${text.toLowerCase()} `

  if (lang === 'Français') {
    return /[àâçéèêëîïôûùüÿœ]/i.test(text) ||
      [' le ', ' la ', ' les ', ' des ', ' une ', ' un ', ' avec ', ' chaîne ', ' français ', ' vidéo ', ' abonne '].some(w => t.includes(w))
  }

  if (lang === 'Espagnol') {
    return /[áéíóúñ¿¡]/i.test(text) ||
      [' el ', ' la ', ' los ', ' las ', ' una ', ' con ', ' español ', ' canal ', ' vídeos '].some(w => t.includes(w))
  }

  if (lang === 'Portugais') {
    return /[áàâãçéêíóôõú]/i.test(text) ||
      [' de ', ' com ', ' para ', ' você ', ' canal ', ' português ', ' brasil ', ' vídeos '].some(w => t.includes(w))
  }

  if (lang === 'Allemand') {
    return /[äöüß]/i.test(text) ||
      [' der ', ' die ', ' das ', ' und ', ' deutsch ', ' kanal ', ' videos '].some(w => t.includes(w))
  }

  return true
}

async function fetchAboutText(channelId: string): Promise<string> {
  try {
    const aboutUrl = `https://www.youtube.com/channel/${channelId}/about`

    const res = await fetch(aboutUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      cache: 'no-store',
    })

    if (!res.ok) return ''

    const html = await res.text()
    return decodeHtml(html)
  } catch {
    return ''
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
}

export type { YouTubeDiscoveryCatalog } from '@/lib/youtubeCatalog'
export { filterYouTubeCatalog } from '@/lib/youtubeCatalog'

function getProspectScore(channel: any): number {
  let score = 20

  if (channel.email) score += 20
  if (channel.instagram) score += 8
  if (channel.tiktok) score += 8
  if (channel.twitch) score += 6
  if (channel.website) score += 8

  if (channel.subsNum >= 10000 && channel.subsNum <= 300000) score += 20
  else if (channel.subsNum > 300000 && channel.subsNum <= 1000000) score += 12
  else if (channel.subsNum > 1000000 && channel.subsNum <= 2000000) score += 6

  if (channel.videoCount >= 200) score += 12
  else if (channel.videoCount >= 50) score += 8

  if (channel.totalViews >= 10000000) score += 10
  else if (channel.totalViews >= 1000000) score += 6

  if (channel.desc && channel.desc.length > 80) score += 5

  return Math.min(score, 100)
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent prospect'
  if (score >= 60) return 'Bon prospect'
  return 'Potentiel faible'
}

function getScoreColor(score: number): string {
  if (score >= PROSPECT_SCORE_THRESHOLDS.excellent) return 'green'
  if (score >= 60) return 'yellow'
  return 'red'
}

function getScoreReason(channel: any): string {
  const hasDirectContact = Boolean(channel.email || channel.website)
  const hasPublicContact = Boolean(
    channel.email || channel.instagram || channel.tiktok || channel.twitch || channel.website
  )
  const isActive = Number(channel.videoCount || 0) >= 50
  const hasGoodVolume = Number(channel.totalViews || 0) >= 1000000 || Number(channel.subsNum || 0) >= 10000

  if (hasDirectContact && isActive) return 'Contact direct disponible et chaîne active'
  if (hasGoodVolume && !hasPublicContact) return 'Bon volume, mais peu de contacts publics'
  return "Faible potentiel ou peu d'informations disponibles"
}

function getChannelAge(publishedAt: string | null): number | null {
  if (!publishedAt) return null
  const created = new Date(publishedAt)
  if (Number.isNaN(created.getTime())) return null
  return Math.max(0, (Date.now() - created.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

function getAdvancedScoreLabel(score: number): string {
  if (score >= PROSPECT_SCORE_THRESHOLDS.exceptional) return '🔥 Prospect exceptionnel'
  if (score >= PROSPECT_SCORE_THRESHOLDS.excellent) return '🟢 Excellent prospect'
  if (score >= PROSPECT_SCORE_THRESHOLDS.good) return '🟡 Bon prospect'
  if (score >= PROSPECT_SCORE_THRESHOLDS.medium) return '🟠 Prospect moyen'
  return '🔴 Faible potentiel'
}

function getAdvancedScoreColor(score: number): string {
  if (score >= PROSPECT_SCORE_THRESHOLDS.excellent) return 'green'
  if (score >= PROSPECT_SCORE_THRESHOLDS.good) return 'yellow'
  if (score >= PROSPECT_SCORE_THRESHOLDS.medium) return 'orange'
  return 'red'
}

function getAdvancedProspectScore(channel: any) {
  let score = 0
  const reasons: string[] = []

  if (channel.email) {
    score += 20
    reasons.push('Email professionnel trouvé')
  }
  if (channel.instagram) {
    score += 8
    reasons.push('Instagram présent')
  }
  if (channel.tiktok) {
    score += 8
    reasons.push('TikTok présent')
  }
  if (channel.twitch) {
    score += 5
    reasons.push('Twitch présent')
  }
  if (channel.website) {
    score += 5
    reasons.push('Site web présent')
  }

  if (channel.subsNum >= 10000 && channel.subsNum <= 300000) {
    score += 20
    reasons.push('Taille de chaîne idéale')
  } else if (channel.subsNum > 300000 && channel.subsNum <= 1000000) {
    score += 12
    reasons.push('Audience solide')
  }

  if (channel.videoCount > 100) {
    score += 10
    reasons.push('Chaîne active')
  }

  if (channel.viewCount > 1000000) {
    score += 10
    reasons.push('Plus de 1M vues')
  }

  if (channel.viewsPerSubscriber > 20) {
    score += 10
    reasons.push('Très bon ratio vues/abonnés')
  }

  if (channel.channelAge !== null && channel.channelAge < 5) {
    score += 5
    reasons.push('Chaîne récente')
  }

  if (channel.desc && channel.desc.length > 100) {
    score += 5
    reasons.push('Description détaillée')
  }

  const finalScore = Math.min(score, 100)

  return {
    score: finalScore,
    label: getAdvancedScoreLabel(finalScore),
    reason: reasons.length > 0 ? reasons.join(' • ') : "Peu d'informations exploitables",
  }
}

export async function discoverYouTubeCatalog(
  niche: string,
  lang: string,
  subsMin: number,
  subsMax: number,
  metrics?: YouTubeCallMetrics,
  existingCatalog?: YouTubeDiscoveryCatalog | null
) {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey || !/^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey.trim())) {
    throw new YouTubeApiError(
      'YOUTUBE_KEY_INVALID',
      'Configuration YouTube invalide.',
      { status: 503, endpoint: 'configuration' }
    )
  }

  const queries = buildYouTubeQueryVariants(niche, lang).slice(0, MAX_YOUTUBE_SEARCH_QUERIES)
  const knownChannelIds = new Set<string>((existingCatalog?.channels || []).map(channel => channel.id).filter(Boolean))
  const channelsById = new Map<string, any>()
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
    })
    searchUrl.search = searchParams.toString()
    console.info('YouTube search request prepared:', getSafeYouTubeSearchParamsLog(searchParams))
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
    if (!shouldRunNextYouTubeQuery({
      acceptedResults: currentRange.accepted.length,
      queriesUsed: metrics?.searchQueriesUsed || queries.indexOf(query) + 1,
      totalVariants: queriesToRun.length,
    })) break
  }

  const range = analyzeYouTubeChannelRange(Array.from(channelsById.values()), subsMin, subsMax)
  if (metrics) {
    metrics.hiddenSubscribers = range.hiddenSubscribers
    metrics.belowMinimum = range.belowMinimum
    metrics.aboveMaximum = range.aboveMaximum
  }
  const candidates = Array.from(channelsById.values())
    .map((ch: any) => {
      const subsNum = Number(ch.statistics?.subscriberCount || 0)
      const viewCount = Number(ch.statistics?.viewCount || 0)
      const totalViews = viewCount
      const videoCount = Number(ch.statistics?.videoCount || 0)
      const publishedAt = ch.snippet?.publishedAt || null
      const createdAt = publishedAt
      const channelAge = getChannelAge(publishedAt)
      const viewsPerSubscriber = subsNum > 0 ? viewCount / subsNum : 0
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

      const advancedScore = getAdvancedProspectScore(channel)

      return {
        ...channel,
        score: advancedScore.score,
        scoreLabel: advancedScore.label,
        scoreColor: getAdvancedScoreColor(advancedScore.score),
        scoreReason: advancedScore.reason,
      }
    })
    .filter((ch: any) => {
      const text = `${ch.name} ${ch.desc}`
      if (!looksLikeLanguage(text, lang)) {
        return ch.email || ch.instagram || ch.tiktok || ch.twitch || ch.website
      }
      return true
    })
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 150)

  const enriched = await Promise.all(
    candidates.map(async (channel: any) => {
      const needsEnrichment =
        !channel.email || !channel.instagram || !channel.tiktok || !channel.twitch || !channel.website

      if (!needsEnrichment) return channel

      if (metrics) metrics.aboutPages += 1
      const aboutText = await fetchAboutText(channel.id)
      if (!aboutText) return channel

      const aboutEmail = extractEmail(aboutText)
      const aboutSocials = extractSocialLinks(aboutText)

      const enrichedChannel = {
        ...channel,
        email: channel.email || aboutEmail,
        instagram: channel.instagram || aboutSocials.instagram,
        tiktok: channel.tiktok || aboutSocials.tiktok,
        twitch: channel.twitch || aboutSocials.twitch,
        website: channel.website || aboutSocials.website,
      }

      const advancedScore = getAdvancedProspectScore(enrichedChannel)

      return {
        ...enrichedChannel,
        score: advancedScore.score,
        scoreLabel: advancedScore.label,
        scoreColor: getAdvancedScoreColor(advancedScore.score),
        scoreReason: advancedScore.reason,
      }
    })
  )

  const finalResults = enriched
    .filter((ch: any) => {
      const text = `${ch.name} ${ch.desc}`
      if (!looksLikeLanguage(text, lang)) {
        return ch.email || ch.instagram || ch.tiktok || ch.twitch || ch.website
      }
      return true
    })
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
