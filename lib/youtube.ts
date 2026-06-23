const NICHE_QUERIES: Record<string, string> = {
  'Gaming': 'gaming gameplay lets play',
  'Finance & Business': 'finance business investissement',
  'Tech & Programmation': 'tech programmation informatique',
  'Fitness & Santé': 'fitness musculation sport',
  'Lifestyle & Vlog': 'lifestyle vlog',
  'Cuisine': 'cuisine recette',
  'Musique': 'musique music',
  'Éducation': 'education tutoriel formation',
  'Voyage': 'voyage travel',
  'Beauté & Mode': 'beauté mode maquillage',
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

export async function searchYouTubeChannels(
  niche: string,
  lang: string,
  subsMin: number,
  subsMax: number,
  maxResults: number
) {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_API_KEY manquante')

  const query = NICHE_QUERIES[niche] || niche || 'youtube'
  const relevanceLanguage = LANG_CODES[lang] || 'fr'

  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}` +
    `&relevanceLanguage=${relevanceLanguage}&maxResults=50&key=${apiKey}`

  const searchRes = await fetch(searchUrl)
  const searchData = await searchRes.json()

  if (searchData.error) {
    throw new Error(searchData.error.message || 'Erreur YouTube Search API')
  }

  const channelIds = Array.from(
    new Set(
      (searchData.items || [])
        .map((item: any) => item.snippet?.channelId)
        .filter(Boolean)
    )
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

  const filtered = (channelsData.items || [])
    .map((ch: any) => {
      const subsNum = Number(ch.statistics?.subscriberCount || 0)

      return {
        id: ch.id,
        name: ch.snippet?.title || 'Chaîne inconnue',
        subs: formatSubs(subsNum),
        subsNum,
        niche,
        lang,
        freq: 'Inconnu',
        email: null,
        desc: (ch.snippet?.description || 'Pas de description disponible.').slice(0, 160),
        avatar: (ch.snippet?.title || 'YT').slice(0, 2).toUpperCase(),
        color: '#533AB7',
        thumbnail: ch.snippet?.thumbnails?.default?.url || null,
      }
    })
    .filter((ch: any) => ch.subsNum >= subsMin && ch.subsNum <= subsMax)
    .slice(0, maxResults)

  return filtered
}