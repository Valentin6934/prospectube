export type PublicEmailSource = 'channel_description' | 'video_description'
export type PublicEmailConfidence = 'high' | 'medium' | 'low'

export type PublicContactText = {
  text: string
  source: PublicEmailSource
  publishedAt?: string | null
}

export type PublicEmailCandidate = {
  email: string
  source: PublicEmailSource
  confidence: PublicEmailConfidence
  context: string
  occurrences: number
  score: number
}

const COMMERCIAL_CONTEXT = /\b(contact|business|professionnel|pro\b|partenariat|collaboration|booking|commercial|pour me contacter)\b/i
const THIRD_PARTY_CONTEXT = /\b(sponsor|musique|music|support technique|copyright|r[ée]clamation|source|cr[ée]dit|agence de|citation)\b/i
const BLOCKED_LOCAL_PARTS = new Set(['example', 'test', 'email', 'votre', 'name', 'nom', 'noreply', 'no-reply', 'donotreply'])
const BLOCKED_DOMAINS = new Set(['example.com', 'test.com', 'email.com', 'domain.com', 'example.org'])
const EMAIL_PATTERN = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi

function foldUnicode(value: string): string {
  return value.normalize('NFKC').replace(/[＠﹫]/g, '@').replace(/[．。｡]/g, '.')
}

export function normalizeObfuscatedEmail(text: string): string {
  return foldUnicode(text)
    .replace(/\s*(?:\[|\(|\{)\s*(?:at|arobase)\s*(?:\]|\)|\})\s*/gi, '@')
    .replace(/\s+(?:at|arobase)\s+/gi, '@')
    .replace(/\s*(?:\[|\(|\{)\s*(?:dot|point)\s*(?:\]|\)|\})\s*/gi, '.')
    .replace(/\s+(?:dot|point)\s+/gi, '.')
    .replace(/\s*@\s*/g, '@')
    .replace(/(?<=\b[a-z0-9_%+-])\s*\.\s*(?=[a-z]{2,24}\b)/gi, '.')
}

function isPlausiblePublicEmail(email: string): boolean {
  if (email.length < 6 || email.length > 254 || email.split('@').length !== 2) return false
  const [local, domain] = email.toLowerCase().split('@')
  if (!local || !domain || local.length > 64 || BLOCKED_LOCAL_PARTS.has(local) || BLOCKED_DOMAINS.has(domain)) return false
  if (/\.(?:png|jpe?g|gif|webp|svg|css|js)$/i.test(domain) || /@\d+x\./i.test(email)) return false
  const labels = domain.split('.')
  const tld = labels.at(-1) || ''
  if (labels.length < 2 || !/^[a-z]{2,24}$/i.test(tld)) return false
  return labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
}

function cleanContext(text: string, index: number, length: number): string {
  return text.slice(Math.max(0, index - 90), Math.min(text.length, index + length + 90))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220)
}

function recencyBonus(publishedAt?: string | null): number {
  if (!publishedAt) return 0
  const age = Date.now() - new Date(publishedAt).getTime()
  return Number.isFinite(age) && age >= 0 && age < 2 * 365.25 * 24 * 60 * 60 * 1000 ? 8 : -4
}

export function extractPublicEmails(input: string | PublicContactText[]): PublicEmailCandidate[] {
  const sources: PublicContactText[] = typeof input === 'string'
    ? [{ text: input, source: 'channel_description' }]
    : input
  const occurrences: Array<Omit<PublicEmailCandidate, 'confidence' | 'occurrences'>> = []

  for (const source of sources) {
    if (!source.text?.trim()) continue
    const normalized = normalizeObfuscatedEmail(source.text)
    const emailPattern = new RegExp(EMAIL_PATTERN.source, EMAIL_PATTERN.flags)
    let match: RegExpExecArray | null
    while ((match = emailPattern.exec(normalized)) !== null) {
      const email = match[0].replace(/[.,;:!?]+$/, '').toLowerCase()
      if (!isPlausiblePublicEmail(email)) continue
      const context = cleanContext(normalized, match.index, match[0].length)
      let score = source.source === 'channel_description' ? 45 : 35
      if (COMMERCIAL_CONTEXT.test(context)) score += 35
      if (THIRD_PARTY_CONTEXT.test(context)) score -= 45
      score += recencyBonus(source.publishedAt)
      occurrences.push({ email, source: source.source, context, score })
    }
  }

  const grouped = new Map<string, typeof occurrences>()
  for (const occurrence of occurrences) {
    const current = grouped.get(occurrence.email) || []
    current.push(occurrence)
    grouped.set(occurrence.email, current)
  }

  return Array.from(grouped.entries()).map(([email, values]) => {
    const best = [...values].sort((a, b) => b.score - a.score)[0]
    const score = best.score + Math.min(20, (values.length - 1) * 10)
    const confidence: PublicEmailConfidence = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'
    return { ...best, email, score, confidence, occurrences: values.length }
  })
}

export function rankPublicEmailCandidates(candidates: PublicEmailCandidate[]): PublicEmailCandidate[] {
  return [...candidates].sort((a, b) => b.score - a.score || b.occurrences - a.occurrences || a.email.localeCompare(b.email))
}

export function selectBestPublicEmail(candidates: PublicEmailCandidate[]): PublicEmailCandidate | null {
  return rankPublicEmailCandidates(candidates).find(candidate => candidate.confidence !== 'low') || null
}

export function redactEmailForLogs(email?: string | null): string | null {
  if (!email || !email.includes('@')) return null
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}***@${domain.slice(0, 1)}***`
}
