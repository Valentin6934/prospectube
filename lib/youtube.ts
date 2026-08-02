import { selectDiverseProspectPreview } from '@/lib/freePreview'
import { SMALL_CREATOR_NICHE_QUERIES, YOUTUBE_NICHE_QUERIES } from '@/lib/niches'
import { PROSPECT_SCORE_THRESHOLDS } from '@/lib/prospectScoreInfo'
import { YouTubeApiError, classifyYouTubeError } from '@/lib/youtubeQuota'
import {
  buildYouTubeSearchParams,
  getSafeYouTubeSearchParamsLog,
  normalizeYouTubeLanguage,
} from '@/lib/youtubeSearchParams'

const MAX_SEARCH_QUERIES = 1
const MAX_SEARCH_PAGES_PER_QUERY = 1
const YOUTUBE_REQUEST_TIMEOUT_MS = 12_000
const YOUTUBE_SEARCH_FIELDS = 'items(snippet(channelId,title,description,thumbnails/default/url)),nextPageToken'
const YOUTUBE_CHANNEL_FIELDS = 'items(id,snippet(title,description,publishedAt,thumbnails/default/url),statistics(subscriberCount,viewCount,videoCount),brandingSettings/channel/description)'

const BASE_NICHE_QUERIES: Record<string, string> = {
  'Gaming': 'gaming gameplay streamer',
  'Finance & Business': 'finance business investing entrepreneur',
  'Tech & Programmation': 'tech programming coding',
  'Fitness & Santé': 'fitness health workout',
  'Lifestyle & Vlog': 'lifestyle vlog',
  'Cuisine': 'cooking recipe',
  'Musique': 'music',
  'Éducation': 'education tutorial',
  'Voyage': 'travel',
  'Beauté & Mode': 'beauty fashion',
}

const LANGUAGE_QUERIES: Record<string, string[]> = {
  fr: ['français', 'france', 'chaîne française', 'youtubeur français'],
  en: ['english', 'usa', 'uk', 'english channel'],
  es: ['español', 'españa', 'mexico', 'canal español'],
  pt: ['português', 'brasil', 'canal português'],
  de: ['deutsch', 'deutschland', 'deutscher kanal'],
  it: ['italiano', 'italia', 'canale italiano'],
}

const SMALL_CREATOR_QUERIES: Record<string, string[]> = {
  'Gaming': ['petit youtubeur', 'gaming fr', 'gameplay fr', 'streamer fr', 'nouvelle chaîne gaming'],
  'Finance & Business': ['investissement débutant', 'business français', 'entrepreneur français'],
  'Tech & Programmation': ['développeur français', 'programmation français', 'coding français'],
  'Fitness & Santé': ['fitness français', 'musculation français', 'coach sportif français'],
  'Lifestyle & Vlog': ['vlog français', 'lifestyle français'],
  'Cuisine': ['recette française', 'cuisine maison'],
  'Musique': ['musicien français', 'beatmaker français'],
  'Éducation': ['tutoriel français', 'formation français'],
  'Voyage': ['vlog voyage français', 'voyage français'],
  'Beauté & Mode': ['mode française', 'beauté française'],
}

function buildQueries(niche: string, lang: string): string[] {
  const base = YOUTUBE_NICHE_QUERIES[niche] || BASE_NICHE_QUERIES[niche] || niche || 'youtube'
  const languageCode = normalizeYouTubeLanguage(lang)
  const langTerms = languageCode ? LANGUAGE_QUERIES[languageCode] || [] : []
  const smallTerms = SMALL_CREATOR_NICHE_QUERIES[niche] || SMALL_CREATOR_QUERIES[niche] || []

  const queries = [
    `${base} ${langTerms[0] || ''}`,
    `${base} ${langTerms[1] || ''}`,
    smallTerms[0] || `${base} ${langTerms[2] || ''}`,
  ]

  return Array.from(new Set(queries.map(q => q.trim()).filter(Boolean))).slice(0, MAX_SEARCH_QUERIES)
}

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
}

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

export async function searchYouTubeChannels(
  niche: string,
  lang: string,
  subsMin: number,
  subsMax: number,
  maxResults: number,
  metrics?: YouTubeCallMetrics
) {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey || !/^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey.trim())) {
    throw new YouTubeApiError(
      'YOUTUBE_KEY_INVALID',
      'Configuration YouTube invalide.',
      { status: 503, endpoint: 'configuration' }
    )
  }

  const queries = buildQueries(niche, lang)

  let allItems: any[] = []

  for (const query of queries) {
    let nextPageToken = ''

    for (let i = 0; i < MAX_SEARCH_PAGES_PER_QUERY; i++) {
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
      const searchParams = buildYouTubeSearchParams({
        query,
        language: lang,
        maxResults: 50,
        pageToken: nextPageToken,
        fields: YOUTUBE_SEARCH_FIELDS,
      })
      searchUrl.search = searchParams.toString()
      console.info('YouTube search request prepared:', getSafeYouTubeSearchParamsLog(searchParams))
      searchUrl.searchParams.set('key', apiKey)

      if (metrics) metrics.searchList += 1
      const searchData = await fetchYouTubeJson(searchUrl, 'search.list')

      allItems.push(...(searchData.items || []))

      if (!searchData.nextPageToken) break
      nextPageToken = searchData.nextPageToken
    }
  }

  const channelIds = Array.from(
    new Set(allItems.map((item: any) => item.snippet?.channelId).filter(Boolean))
  )

  if (channelIds.length === 0) return []

  let allChannels: any[] = []

  for (let i = 0; i < channelIds.length; i += 50) {
    const batchIds = channelIds.slice(i, i + 50)

    const channelsUrl = new URL('https://www.googleapis.com/youtube/v3/channels')
    channelsUrl.searchParams.set('part', 'snippet,statistics,brandingSettings')
    channelsUrl.searchParams.set('id', batchIds.join(','))
    channelsUrl.searchParams.set('fields', YOUTUBE_CHANNEL_FIELDS)
    channelsUrl.searchParams.set('key', apiKey)

    if (metrics) metrics.channelsList += 1
    const channelsData = await fetchYouTubeJson(channelsUrl, 'channels.list', batchIds.length)

    allChannels.push(...(channelsData.items || []))
  }

  const candidates = allChannels
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
    .filter((ch: any) => ch.subsNum >= subsMin && ch.subsNum <= subsMax)
    .filter((ch: any) => {
      const text = `${ch.name} ${ch.desc}`
      if (!looksLikeLanguage(text, lang)) {
        return ch.email || ch.instagram || ch.tiktok || ch.twitch || ch.website
      }
      return true
    })
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, Math.max(maxResults * 3, maxResults))

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

  if (maxResults <= 3) {
    return selectDiverseProspectPreview(finalResults, maxResults)
  }

  return finalResults.slice(0, maxResults)
}
