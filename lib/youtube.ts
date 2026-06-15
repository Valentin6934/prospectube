const NICHE_QUERIES: Record<string, string> = {
  'Gaming': 'gaming gameplay let\'s play',
  'Finance & Business': 'finance investissement business argent',
  'Tech & Programmation': 'tech technologie programmation informatique',
  'Fitness & Santé': 'fitness musculation sport santé',
  'Lifestyle & Vlog': 'lifestyle vlog quotidien',
  'Cuisine': 'cuisine recette cooking',
  'Musique': 'musique music beatmaking',
  'Éducation': 'éducation apprendre tutoriel formation',
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

const COLORS = ['#7B63D3', '#0F6E56', '#B45309', '#9D1717', '#0C447C', '#166534', '#92400E', '#1E40AF', '#6D28D9', '#BE185D']

function formatSubs(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1000) return Math.round(n / 1000) + 'K'
  return String(n)
}

function randomColor(seed: string) {
  const idx = seed.charCodeAt(0) % COLORS.length
  return COLORS[idx]
}

async function getUploadFrequency(uploadsPlaylistId: string, apiKey: string): Promise<string> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=5&key=${apiKey}`
    const res = await fetch(url)
    const data = await res.json()
    const dates = (data.items || []).map((v: any) => new Date(v.snippet.publishedAt).getTime())
    if (dates.length < 2) return 'Inconnu'
    const diffs: number[] = []
    for (let i = 0; i < dates.length - 1; i++) diffs.push(Math.abs(dates[i] - dates[i + 1]))
    const avgDays = (diffs.reduce((a, b) => a + b, 0) / diffs.length) / (1000 * 60 * 60 * 24)
    if (avgDays < 1.5) return '1x/jour'
    if (avgDays <= 2.5) return '5x/semaine'
    if (avgDays <= 4) return '3x/semaine'
    if (avgDays <= 8) return '1x/semaine'
    if (avgDays <= 16) return '2x/mois'
    return 'Rarement'
  } catch {
    return 'Inconnu'
  }
}

async function tryGetEmail(channelId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}/about`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    })
    const html = await res.text()
    const match = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    return match ? match[0] : null
  } catch {
    return null
  }
}

export async function searchYouTubeChannels(niche: string, lang: string, subsMin: number, subsMax: number, maxResults: number) {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey || apiKey.includes('AIza...')) {
    throw new Error('Clé API YouTube non configurée')
  }

  const query = NICHE_QUERIES[niche] || niche
  const relevanceLanguage = LANG_CODES[lang] || 'fr'

  // 1. Recherche de chaînes
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&relevanceLanguage=${relevanceLanguage}&maxResults=25&key=${apiKey}`
  const searchRes = await fetch(searchUrl)
  const searchData = await searchRes.json()
  if (searchData.error) throw new Error(searchData.error.message || 'Erreur API YouTube')

  const channelIds = [...new Set((searchData.items || []).map((item: any) => item.snippet.channelId).filter(Boolean))]
  if (channelIds.length === 0) return []

  // 2. Stats des chaînes
  const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelIds.join(',')}&key=${apiKey}`
  const channelsRes = await fetch(channelsUrl)
  const channelsData = await channelsRes.json()
  if (channelsData.error) throw new Error(channelsData.error.message || 'Erreur API YouTube')

  let channels = (channelsData.items || []).filter((ch: any) => {
    const subs = parseInt(ch.statistics?.subscriberCount || '0')
    return subs >= subsMin && subs <= subsMax
  })

  channels = channels.slice(0, maxResults)

  // 3. Fréquence + email pour chaque chaîne
  const results = await Promise.all(channels.map(async (ch: any) => {
    const subs = parseInt(ch.statistics?.subscriberCount || '0')
    const uploadsPlaylist = ch.contentDetails?.relatedPlaylists?.uploads
    const [freq, email] = await Promise.all([
      uploadsPlaylist ? getUploadFrequency(uploadsPlaylist, apiKey) : Promise.resolve('Inconnu'),
      tryGetEmail(ch.id),
    ])

    return {
      id: ch.id,
      name: ch.snippet.title,
      subs: formatSubs(subs),
      subsNum: subs,
      niche,
      lang,
      freq,
      email,
      desc: (ch.snippet.description || 'Pas de description disponible.').slice(0, 160),
      avatar: ch.snippet.title.slice(0, 2).toUpperCase(),
      color: randomColor(ch.snippet.title),
      thumbnail: ch.snippet.thumbnails?.default?.url || null,
    }
  }))

  return results
}
