export type GmailOAuthErrorCode =
  | 'OAUTH_NOT_CONFIGURED'
  | 'OAUTH_REDIRECT_MISMATCH'
  | 'OAUTH_ACCESS_DENIED'
  | 'OAUTH_APP_UNVERIFIED'
  | 'OAUTH_ACCOUNT_NOT_ALLOWED'
  | 'GMAIL_TOKEN_EXPIRED'
  | 'GMAIL_SCOPE_INSUFFICIENT'
  | 'GMAIL_INTERNAL_ERROR'

const SAFE_MESSAGES: Record<GmailOAuthErrorCode, string> = {
  OAUTH_NOT_CONFIGURED: 'La connexion Gmail est temporairement indisponible.',
  OAUTH_REDIRECT_MISMATCH: 'La connexion Gmail est temporairement indisponible.',
  OAUTH_ACCESS_DENIED: 'L’autorisation Gmail a été annulée.',
  OAUTH_APP_UNVERIFIED: 'La connexion Gmail n’est pas encore disponible pour tous les comptes Google.',
  OAUTH_ACCOUNT_NOT_ALLOWED: 'Ce compte Google n’est pas autorisé à utiliser la connexion Gmail pour le moment.',
  GMAIL_TOKEN_EXPIRED: 'Votre connexion Gmail a expiré. Reconnectez votre compte pour continuer.',
  GMAIL_SCOPE_INSUFFICIENT: 'L’autorisation Gmail ne permet pas de créer des brouillons. Reconnectez Gmail.',
  GMAIL_INTERNAL_ERROR: 'La connexion Gmail a échoué. Réessayez dans quelques instants.',
}

export function getSafeGmailOAuthMessage(code: GmailOAuthErrorCode): string {
  return SAFE_MESSAGES[code]
}

export function classifyGoogleOAuthError(value?: string | null): GmailOAuthErrorCode {
  const normalized = String(value || '').toLowerCase()
  if (normalized.includes('redirect_uri_mismatch')) return 'OAUTH_REDIRECT_MISMATCH'
  if (normalized.includes('unverified') || normalized.includes('not verified') || normalized.includes('verification')) return 'OAUTH_APP_UNVERIFIED'
  if (normalized.includes('not_allowed') || normalized.includes('org_internal') || normalized.includes('test_user')) return 'OAUTH_ACCOUNT_NOT_ALLOWED'
  if (normalized.includes('access_denied')) return 'OAUTH_ACCESS_DENIED'
  return 'GMAIL_INTERNAL_ERROR'
}

export function isConnectedOAuthReplay(error?: string | null, existingRefreshToken?: string | null): boolean {
  return String(error || '').toLowerCase() === 'invalid_grant' && Boolean(existingRefreshToken)
}

export function logSafeGmailOAuthFailure(input: {
  code: GmailOAuthErrorCode
  step: string
  error?: unknown
}) {
  console.error({
    event: 'gmail_oauth_failed',
    code: input.code,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    provider: 'google',
    step: input.step,
    errorName: input.error instanceof Error ? input.error.name : undefined,
  })
}
