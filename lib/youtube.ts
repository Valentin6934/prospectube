const NICHE_QUERIES: Record<string, string> = {
  'Gaming': 'gaming france français gameplay',
  'Finance & Business': 'finance business investissement français',
  'Tech & Programmation': 'tech programmation informatique français',
  'Fitness & Santé': 'fitness musculation sport français',
  'Lifestyle & Vlog': 'lifestyle vlog français',
  'Cuisine': 'cuisine recette français',
  'Musique': 'musique français',
  'Éducation': 'education tutoriel formation français',
  'Voyage': 'voyage travel français',
  'Beauté & Mode': 'beauté mode maquillage français',
}

const LANG_CODES: Record<string, string> = {
  'Français': 'fr',
  'Anglais': 'en',
  'Espagnol': 'es',
  'Portugais': 'pt',
  'Allemand': 'de',
}

function formatSubs(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(n)
}

function looksFrench(text: string): boolean {
  const t = ` ${text.toLowerCase()} `
  const words = [' le ', ' la ', ' les ', ' des ', ' une ', ' un ', ' je ', ' nous ', ' vous ', ' avec ', ' chaîne ', ' français ', ' bienvenue ', ' vidéo ', ' abonnés ']
  return words.some(w => t.includes(w))
}

function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : null
}

function normalizeUrl(url: string | null): string | null {
  if (!url) return null
  return url.startsWith('http') ? url : `https://${url}`
}

function extractSocialLinks(text: string) {
  const instagram = text.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/[A-Za-z0-9._-]+/i)?.[0] || null
  const tiktok = text.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[A-Za-z0-9._-]+/i)?.[0] || null
  const twitch = text.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/[A-Za-z0-9_]+/i)?.[0] || null

  const website =
    text.match(/https?:\/\/(?!.*(?:instagram|tiktok|twitch|youtube|youtu\.be|facebook|twitter|x\.com))[^\s)]+/i)?.[0] ||
    null

  return {
    instagram: normalizeUrl(instagram),
    tiktok: normalizeUrl(tiktok),
    twitch: normalizeUrl(twitch),
    website: normalizeUrl(website),
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
  if (channel.lang === 'Français') score += 10

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

  const baseQuery = NICHE_QUERIES[niche] || niche || 'youtube'
  const query = lang === 'Français' ? `${baseQuery} chaîne française` : baseQuery
  const relevanceLanguage = LANG_CODES[lang] || 'fr'

  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}` +
    `&relevanceLanguage=${relevanceLanguage}&regionCode=${relevanceLanguage.toUpperCase()}&maxResults=50&key=${apiKey}`

  const searchRes = await fetch(searchUrl)
  const searchData = await searchRes.json()

  if (searchData.error) {
    throw new Error(searchData.error.message || 'Erreur YouTube Search API')
  }

  const channelIds = Array.from(
    new Set((searchData.items || []).map((item: any) => item.snippet?.channelId).filter(Boolean))
  )

  if (channelIds.length === 0) return []

  const channelsUrl =
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails` +
    `&id=${channelIds.join(',')}&key=${apiKey}`

  const channelsRes = await fetch(channelsUrl)
  const channelsData = await channelsRes.json()

  if (channelsData.error) {
    throw new Error(channelsData.error.message || 'Erreur YouTube Channels API')
  }

  return (channelsData.items || [])
    .map((ch: any) => {
      const subsNum = Number(ch.statistics?.subscriberCount || 0)
      const fullDesc = ch.snippet?.description || ''
      const desc = (fullDesc || 'Pas de description disponible.').slice(0, 160)
      const email = extractEmail(fullDesc)
      const socials = extractSocialLinks(fullDesc)

      const channel = {
        id: ch.id,
        name: ch.snippet?.title || 'Chaîne inconnue',
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
    .filter((ch: any) => {
      const inRange = ch.subsNum >= subsMin && ch.subsNum <= subsMax
      if (lang !== 'Français') return inRange
      return inRange && looksFrench(`${ch.name} ${ch.desc}`)
    })
    .slice(0, maxResults)
}