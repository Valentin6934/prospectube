export type ProspectPresentationInput = {
  id?: string | null
  channelId?: string | null
  name?: string | null
  subs?: string | null
  subsNum?: number | null
  score?: number | null
  scoreLabel?: string | null
  scoreReason?: string | null
  email?: string | null
  instagram?: string | null
  tiktok?: string | null
  twitch?: string | null
  website?: string | null
  channelUrl?: string | null
  avatar?: string | null
  thumbnail?: string | null
  color?: string | null
  totalViews?: number | null
  viewCount?: number | null
  totalViewsFormatted?: string | null
  videoCount?: number | null
  videoCountFormatted?: string | null
  createdAt?: string | null
  publishedAt?: string | null
  channelCreatedAt?: string | null
}

export type ProspectPresentationContact = {
  key: 'email' | 'instagram' | 'tiktok' | 'twitch' | 'website'
  label: string
  href: string
  color: string
}

export type ProspectPresentationData = {
  name: string
  initials: string
  imageUrl: string | null
  color: string
  score: number
  scoreLabel: string
  scoreReason: string
  stats: string[]
  contacts: ProspectPresentationContact[]
  youtubeUrl: string | null
}

function isHttpUrl(value?: string | null): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function formatProspectCompactNumber(value?: number | null): string {
  const n = Number(value || 0)
  if (n >= 1000000000) return `${(n / 1000000000).toFixed(1).replace('.0', '')}B`
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`
  return String(Math.max(0, Math.round(n)))
}

export function getProspectCreatedYear(channel: ProspectPresentationInput): string | null {
  const date = channel.createdAt || channel.publishedAt || channel.channelCreatedAt
  if (!date) return null
  const year = new Date(date).getFullYear()
  return Number.isFinite(year) ? String(year) : null
}

export function getProspectInitials(name?: string | null, avatar?: string | null): string {
  if (avatar && !isHttpUrl(avatar)) return avatar.slice(0, 3).toUpperCase()
  const value = name || 'YT'
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'YT'
}

export function getProspectImageUrl(channel: ProspectPresentationInput): string | null {
  if (isHttpUrl(channel.avatar)) return channel.avatar || null
  if (isHttpUrl(channel.thumbnail)) return channel.thumbnail || null
  return null
}

export function normalizeProspectPresentation(channel: ProspectPresentationInput): ProspectPresentationData {
  const name = channel.name || 'Chaine inconnue'
  const createdYear = getProspectCreatedYear(channel)
  const subs = channel.subs || `${formatProspectCompactNumber(channel.subsNum)} abonnes`
  const views = channel.totalViewsFormatted || `${formatProspectCompactNumber(channel.totalViews ?? channel.viewCount)} vues`
  const videos = channel.videoCountFormatted || `${formatProspectCompactNumber(channel.videoCount)} videos`

  const contacts = [
    channel.email ? { key: 'email' as const, label: 'Email trouve', href: `mailto:${channel.email}`, color: '#22c55e' } : null,
    channel.instagram ? { key: 'instagram' as const, label: 'Instagram', href: channel.instagram, color: '#e879f9' } : null,
    channel.tiktok ? { key: 'tiktok' as const, label: 'TikTok', href: channel.tiktok, color: '#f472b6' } : null,
    channel.twitch ? { key: 'twitch' as const, label: 'Twitch', href: channel.twitch, color: '#9146FF' } : null,
    channel.website ? { key: 'website' as const, label: 'Site', href: channel.website, color: '#38bdf8' } : null,
  ].filter(Boolean) as ProspectPresentationContact[]

  return {
    name,
    initials: getProspectInitials(name, channel.avatar),
    imageUrl: getProspectImageUrl(channel),
    color: channel.color || '#533AB7',
    score: channel.score || 0,
    scoreLabel: channel.scoreLabel || 'Score inconnu',
    scoreReason: channel.scoreReason || 'Aucune analyse disponible.',
    stats: [subs, views, videos, createdYear ? `cree en ${createdYear}` : null].filter(Boolean) as string[],
    contacts,
    youtubeUrl: isHttpUrl(channel.channelUrl) ? channel.channelUrl || null : null,
  }
}
