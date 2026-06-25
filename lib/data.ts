export const FAKE_CHANNELS = [
  { id: '1', name: 'PixelForge', subs: '87K', subsNum: 87000, niche: 'Gaming', lang: 'Français', freq: '3x/semaine', email: 'contact@pixelforge.fr', desc: 'Gaming FPS & RPG, montage dynamique avec beaucoup d’effets visuels et transitions rapides.', avatar: 'PF', color: '#7B63D3' },
  { id: '2', name: 'TechXpro', subs: '234K', subsNum: 234000, niche: 'Tech & Programmation', lang: 'Français', freq: '2x/semaine', email: null, desc: 'Reviews tech et tutoriels, style épuré et professionnel, beaucoup de B-roll.', avatar: 'TX', color: '#0F6E56' },
]

export function getProspectScore(channel: any): number {
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

export function filterChannels(niche: string, lang: string, subsMin: number, subsMax: number) {
  return FAKE_CHANNELS.filter(ch => {
    const matchNiche = !niche || ch.niche.toLowerCase() === niche.toLowerCase()
    const matchLang = !lang || ch.lang.toLowerCase() === lang.toLowerCase()
    const matchSubs = ch.subsNum >= subsMin && ch.subsNum <= subsMax
    return matchNiche && matchLang && matchSubs
  }).map(ch => ({
    ...ch,
    score: getProspectScore(ch),
  }))
}

export const PLAN_LIMITS = {
  'Gratuit': { searches: 5, results: 3, emailAI: false, exportCSV: false },
  'Pro': { searches: 200, results: 20, emailAI: true, exportCSV: true },
  'Agence': { searches: 9999, results: 50, emailAI: true, exportCSV: true },
}