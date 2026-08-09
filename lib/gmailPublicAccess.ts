export type GmailPublicOAuthStatus = 'production' | 'testing'

export function getGmailPublicOAuthStatus(value = process.env.GMAIL_PUBLIC_OAUTH_STATUS): GmailPublicOAuthStatus {
  return String(value || '').trim().toLowerCase() === 'testing' ? 'testing' : 'production'
}

export function isGmailPublicOAuthAvailable(value = process.env.GMAIL_PUBLIC_OAUTH_STATUS): boolean {
  return getGmailPublicOAuthStatus(value) === 'production'
}

