const LANG_CODES: Record<string, string> = {
  'FranÃ§ais': 'fr',
  'Anglais': 'en',
  'Espagnol': 'es',
  'Portugais': 'pt',
  'Allemand': 'de',
}

const BASE_NICHE_QUERIES: Record<string, string> = {
  'Gaming': 'gaming gameplay streamer',
  'Finance & Business': 'finance business investing entrepreneur',
  'Tech & Programmation': 'tech programming coding',
  'Fitness & SantÃ©': 'fitness health workout',
  'Lifestyle & Vlog': 'lifestyle vlog',
  'Cuisine': 'cooking recipe',
  'Musique': 'music',
  'Ã‰ducation': 'education tutorial',
  'Voyage': 'travel',
  'BeautÃ© & Mode': 'beauty fashion',
}

const LANGUAGE_QUERIES: Record<string, string> = {
  'FranÃ§ais': 'franÃ§ais france',
  'Anglais': 'english usa uk',
  'Espagnol': 'espaÃ±ol espaÃ±a mexico',
  'Portugais': 'portuguÃªs brasil',
  'Allemand': 'deutsch deutschland',
}

function formatSubs(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(n)
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

function decodeHtml(text: string): string {
  return text
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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

function getProspectScore(channel: any): number {
  let score = 30

  if (channel.email) score += 20
  if (channel.instagram) score += 10
  if (channel.tiktok) score += 10
  if (channel.twitch) score += 10
  if (channel.website) score += 10

  if (channel.subsNum >= 10000 && channel.subsNum <= 500000) score += 20
  else if (channel.subsNum > 500000 && channel.subsNum <= 2000000) score += 10

  if (channel.desc && channel.desc.length > 80) score += 10

  return Math.min(score, 100)
}

export async function searchYouTubeChannels(
  niche: string,
  lang: string,
  subsMin: number,
  subsMax: number,
  maxResults: number
) {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_API_KEY manquante')

  const query = `${BASE_NICHE_QUERIES[niche] || niche || 'youtube'} ${LANGUAGE_QUERIES[lang] || ''}`.trim()

  let allItems: any[] = []
  let nextPageToken = ''

  for (let i = 0; i < 3; i++) {
    const searchUrl =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}` +
      `&maxResults=50&key=${apiKey}` +
      `${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`

    const searchRes = await fetch(searchUrl)
    const searchData = await searchRes.json()

    if (searchData.error) {
      throw new Error(searchData.error.message || 'Erreur YouTube Search API')
    }

    allItems.push(...(searchData.items || []))

    if (!searchData.nextPageToken) break
    nextPageToken = searchData.nextPageToken
  }

  const channelIds = Array.from(
    new Set(allItems.map((item: any) => item.snippet?.channelId).filter(Boolean))
  )

  if (channelIds.length === 0) return []

  let allChannels: any[] = []

  for (let i = 0; i < channelIds.length; i += 50) {
    const batchIds = channelIds.slice(i, i + 50)

    const channelsUrl =
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails,brandingSettings` +
      `&id=${batchIds.join(',')}&key=${apiKey}`

    const channelsRes = await fetch(channelsUrl)
    const channelsData = await channelsRes.json()

    if (channelsData.error) {
      throw new Error(channelsData.error.message || 'Erreur YouTube Channels API')
    }

    allChannels.push(...(channelsData.items || []))
  }

  const candidates = allChannels
    .map((ch: any) => {
      const subsNum = Number(ch.statistics?.subscriberCount || 0)
      const snippetDesc = ch.snippet?.description || ''
      const brandingDesc = ch.brandingSettings?.channel?.description || ''
      const fullDesc = `${snippetDesc}\n${brandingDesc}`
      const desc = (fullDesc || 'Pas de description disponible.').slice(0, 160)
      const email = extractEmail(fullDesc)
      const socials = extractSocialLinks(fullDesc)

      const channel = {
        id: ch.id,
        name: ch.snippet?.title || 'ChaÃ®ne inconnue',
        subs: formatSubs(subsNum),
        subsNum,
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

      return {
        ...channel,
        score: getProspectScore(channel),
      }
    })
    .filter((ch: any) => ch.subsNum >= subsMin && ch.subsNum <= subsMax)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, maxResults)

  const enriched = await Promise.all(
    candidates.map(async (channel: any) => {
      const needsEnrichment =
        !channel.email || !channel.instagram || !channel.tiktok || !channel.twitch || !channel.website

      if (!needsEnrichment) return channel

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

      return {
        ...enrichedChannel,
        score: getProspectScore(enrichedChannel),
      }
    })
  )

  return enriched.sort((a: any, b: any) => b.score - a.score)
}