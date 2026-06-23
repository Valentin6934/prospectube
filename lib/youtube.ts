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
      const desc = (ch.snippet?.description || 'Pas de description disponible.').slice(0, 160)

      return {
        id: ch.id,
        name: ch.snippet?.title || 'Chaîne inconnue',
        subs: formatSubs(subsNum),
        subsNum,
        niche,
        lang,
        freq: 'Inconnu',
        email: null,
        desc,
        avatar: (ch.snippet?.title || 'YT').slice(0, 2).toUpperCase(),
        color: '#533AB7',
        thumbnail: ch.snippet?.thumbnails?.default?.url || null,
      }
    })
    .filter((ch: any) => {
      const inRange = ch.subsNum >= subsMin && ch.subsNum <= subsMax
      if (lang !== 'Français') return inRange
      return inRange && looksFrench(`${ch.name} ${ch.desc}`)
    })
    .slice(0, maxResults)
}