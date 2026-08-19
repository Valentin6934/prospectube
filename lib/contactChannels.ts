import { buildGmailComposeUrl } from './emailHandoff'

export type ContactChannelKey = 'email' | 'instagram' | 'tiktok' | 'facebook' | 'twitter' | 'twitch' | 'website'

export type ContactChannelInput = {
  name?: string | null
  email?: string | null
  instagram?: string | null
  tiktok?: string | null
  facebook?: string | null
  twitter?: string | null
  twitch?: string | null
  website?: string | null
}

export type ContactChannel = {
  key: ContactChannelKey
  label: string
  href: string
  color: string
  external: boolean
}

const SOCIAL_HOSTS: Record<Exclude<ContactChannelKey, 'email' | 'website'>, string[]> = {
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  facebook: ['facebook.com', 'fb.com'],
  twitter: ['x.com', 'twitter.com'],
  twitch: ['twitch.tv'],
}

const RESERVED_SOCIAL_PATHS = new Set([
  '', 'about', 'accounts', 'explore', 'home', 'intent', 'login', 'privacy', 'search', 'share', 'signup', 'terms',
])

export function normalizePublicUrl(value: unknown, allowedHosts?: string[]): string | null {
  const raw = typeof value === 'string' ? value.trim().replace(/[),.;!?]+$/, '') : ''
  if (!raw) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (!host || host === 'localhost' || host.endsWith('.local')) return null
    if (allowedHosts && !allowedHosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`))) return null
    if (allowedHosts) {
      const firstPath = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase() || ''
      if (RESERVED_SOCIAL_PATHS.has(firstPath)) return null
    }
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function firstSocialUrl(text: string, hosts: string[]): string | null {
  const escapedHosts = hosts.map(host => host.replace('.', '\\.')).join('|')
  const match = text.match(new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?(?:${escapedHosts})\\/[^\\s\"'<>)}]+`, 'i'))?.[0]
  return normalizePublicUrl(match, hosts)
}

export function extractPublicContactLinks(text: string) {
  const decoded = String(text || '')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  const instagram = firstSocialUrl(decoded, SOCIAL_HOSTS.instagram)
  const tiktok = firstSocialUrl(decoded, SOCIAL_HOSTS.tiktok)
  const facebook = firstSocialUrl(decoded, SOCIAL_HOSTS.facebook)
  const twitter = firstSocialUrl(decoded, SOCIAL_HOSTS.twitter)
  const twitch = firstSocialUrl(decoded, SOCIAL_HOSTS.twitch)
  const urls = decoded.match(/https?:\/\/[^\s\"'<>)}]+/gi) || []
  const socialHosts = Object.values(SOCIAL_HOSTS).flat()
  const website = urls.map(url => normalizePublicUrl(url)).find(url => {
    if (!url) return false
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    return !socialHosts.some(social => host === social || host.endsWith(`.${social}`)) &&
      !['youtube.com', 'youtu.be', 'google.com'].some(blocked => host === blocked || host.endsWith(`.${blocked}`))
  }) || null

  return { instagram, tiktok, facebook, twitter, twitch, website }
}

export function getContactChannels(input: ContactChannelInput, message?: { subject?: string; body?: string }): ContactChannel[] {
  const gmailUrl = buildGmailComposeUrl({
    email: input.email,
    subject: message?.subject || `Collaboration avec ${input.name || 'votre chaîne'}`,
    body: message?.body || '',
  })
  const channels: Array<ContactChannel | null> = [
    gmailUrl ? {
      key: 'email', label: 'Gmail', href: gmailUrl, color: '#67d9a1', external: true,
    } : null,
    ...(['instagram', 'tiktok', 'facebook', 'twitter', 'twitch'] as const).map(key => {
      const href = normalizePublicUrl(input[key], SOCIAL_HOSTS[key])
      if (!href) return null
      const metadata = {
        instagram: ['Instagram', '#e879f9'], tiktok: ['TikTok', '#f472b6'], facebook: ['Facebook', '#60a5fa'],
        twitter: ['X', '#d4d4d8'], twitch: ['Twitch', '#a78bfa'],
      }[key]
      return { key, label: metadata[0], href, color: metadata[1], external: true } as ContactChannel
    }),
    normalizePublicUrl(input.website) ? { key: 'website', label: 'Site', href: normalizePublicUrl(input.website)!, color: '#38bdf8', external: true } : null,
  ]
  return channels.filter(Boolean) as ContactChannel[]
}

export function countContactChannels(input: ContactChannelInput): number {
  return getContactChannels(input).length
}
