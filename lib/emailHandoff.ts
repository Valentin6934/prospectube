export type EmailHandoffInput = {
  email?: string | null
  subject?: string | null
  body?: string | null
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeRecipient(email?: string | null): string | null {
  const normalized = email?.trim().toLowerCase() || ''
  return EMAIL_PATTERN.test(normalized) ? normalized : null
}

export function buildGmailComposeUrl(input: EmailHandoffInput): string | null {
  const recipient = normalizeRecipient(input.email)
  if (!recipient) return null

  const url = new URL('https://mail.google.com/mail/')
  url.searchParams.set('view', 'cm')
  url.searchParams.set('fs', '1')
  url.searchParams.set('to', recipient)
  url.searchParams.set('su', input.subject?.trim() || '')
  url.searchParams.set('body', input.body?.trim() || '')
  return url.toString()
}

export function buildMailtoUrl(input: EmailHandoffInput): string | null {
  const recipient = normalizeRecipient(input.email)
  if (!recipient) return null

  const params = new URLSearchParams()
  params.set('subject', input.subject?.trim() || '')
  params.set('body', input.body?.trim() || '')
  return `mailto:${encodeURIComponent(recipient)}?${params.toString()}`
}

export function buildClipboardMessage(input: EmailHandoffInput): string {
  const subject = input.subject?.trim() || ''
  const body = input.body?.trim() || ''
  return [subject ? `Objet : ${subject}` : '', body].filter(Boolean).join('\n\n')
}
