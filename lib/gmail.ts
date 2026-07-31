import { prisma } from '@/lib/prisma'
import { getSafeGmailErrorMessage, REQUIRED_GMAIL_DRAFT_SCOPE } from '@/lib/gmailStatus'
import { encodeGmailMessage, type GmailMessage } from '@/lib/gmailMessage'

export const SEND_MODE = process.env.GMAIL_SEND_MODE === 'send' ? 'send' : 'draft'

export type GmailErrorCode =
  | 'missing_account'
  | 'missing_refresh_token'
  | 'invalid_refresh_token'
  | 'revoked_access'
  | 'oauth_config'
  | 'google_temporary'
  | 'access_token_expired'
  | 'scope_missing'
  | 'api_not_enabled'
  | 'rate_limited'
  | 'draft_invalid'
  | 'api_rejected'
  | 'status_persist_failed'
  | 'delivery_error'

export class GmailError extends Error {
  constructor(
    message: string,
    public status = 500,
    public code: GmailErrorCode = 'delivery_error',
    public gmailStatus?: number
  ) {
    super(message)
    this.name = 'GmailError'
  }
}

function getGmailApiError(responseStatus: number, data: any, endpoint: string): GmailError {
  const googleCode = typeof data?.error?.status === 'string' ? data.error.status : ''
  const googleReason = typeof data?.error?.errors?.[0]?.reason === 'string' ? data.error.errors[0].reason : ''
  const googleMessage = typeof data?.error?.message === 'string' ? data.error.message : ''

  console.error('Gmail API rejected request:', {
    endpoint,
    status: responseStatus,
    googleCode: googleCode || null,
    googleReason: googleReason || null,
    message: googleMessage ? googleMessage.slice(0, 180) : null,
  })

  if (responseStatus === 400 || googleCode === 'INVALID_ARGUMENT') {
    return new GmailError('Le brouillon est invalide : vérifiez le destinataire, le sujet et le message.', 400, 'draft_invalid', responseStatus)
  }
  if (responseStatus === 401 || googleCode === 'UNAUTHENTICATED' || googleReason === 'authError' || googleReason === 'invalidCredentials') {
    return new GmailError('Votre connexion Gmail a expiré. Reconnectez votre compte pour continuer.', 401, 'access_token_expired', responseStatus)
  }
  if (responseStatus === 403 && (googleReason === 'accessNotConfigured' || googleReason === 'serviceDisabled')) {
    return new GmailError('L’API Gmail n’est pas activée pour ce projet Google.', 403, 'api_not_enabled', responseStatus)
  }
  if (responseStatus === 403 && (googleReason === 'insufficientPermissions' || googleCode === 'PERMISSION_DENIED')) {
    return new GmailError('L’autorisation Gmail actuelle ne permet pas de créer des brouillons. Reconnectez Gmail.', 403, 'scope_missing', responseStatus)
  }
  if (responseStatus === 403) {
    return new GmailError('Google Gmail a refusé la requête.', 403, 'api_rejected', responseStatus)
  }
  if (responseStatus === 429) {
    return new GmailError('Gmail limite temporairement les requêtes. Réessayez dans quelques instants.', 429, 'rate_limited', responseStatus)
  }
  if (responseStatus >= 500) {
    return new GmailError('Google Gmail a temporairement refusé la requête. Réessayez.', 503, 'google_temporary', responseStatus)
  }

  return new GmailError('Google Gmail a refusé la requête.', responseStatus, 'api_rejected', responseStatus)
}

async function refreshAccessToken(userId: string, refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new GmailError(getSafeGmailErrorMessage('oauth_config'), 500, 'oauth_config')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok || typeof data.access_token !== 'string') {
    const googleError = typeof data.error === 'string' ? data.error : ''
    const code: GmailErrorCode =
      googleError === 'invalid_grant'
        ? 'invalid_refresh_token'
        : response.status >= 500
          ? 'google_temporary'
          : 'revoked_access'
    throw new GmailError(getSafeGmailErrorMessage(code), response.status >= 500 ? 503 : 401, code)
  }

  const expiryDate = new Date(Date.now() + Number(data.expires_in || 3600) * 1000)
  await prisma.googleAccount.update({
    where: { userId },
    data: {
      accessToken: data.access_token,
      expiryDate,
      ...(typeof data.refresh_token === 'string' ? { refreshToken: data.refresh_token } : {}),
    },
  })

  return data.access_token as string
}

export async function getValidGmailAccessToken(userId: string, options: { forceRefresh?: boolean } = {}) {
  const account = await prisma.googleAccount.findUnique({ where: { userId } })
  if (!account) throw new GmailError(getSafeGmailErrorMessage('missing_account'), 400, 'missing_account')
  const scopes = typeof account.scope === 'string' ? account.scope.split(/\s+/).filter(Boolean) : []
  if (!scopes.includes(REQUIRED_GMAIL_DRAFT_SCOPE)) {
    throw new GmailError(getSafeGmailErrorMessage('scope_missing'), 403, 'scope_missing')
  }

  const tokenIsValid = account.expiryDate
    ? account.expiryDate.getTime() > Date.now() + 60_000
    : true

  if (tokenIsValid && !options.forceRefresh) return account.accessToken
  if (!account.refreshToken) {
    throw new GmailError(getSafeGmailErrorMessage('missing_refresh_token'), 401, 'missing_refresh_token')
  }

  return refreshAccessToken(userId, account.refreshToken)
}

export async function deliverGmailMessage(accessToken: string, message: GmailMessage) {
  let raw: string
  try {
    raw = encodeGmailMessage(message)
  } catch {
    throw new GmailError('Le brouillon est invalide : vérifiez le destinataire, le sujet et le message.', 400, 'draft_invalid')
  }
  const endpoint = SEND_MODE === 'send'
    ? 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
    : 'https://gmail.googleapis.com/gmail/v1/users/me/drafts'
  const payload = SEND_MODE === 'send' ? { raw } : { message: { raw } }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw getGmailApiError(response.status, data, endpoint)
  }

  const messageId = SEND_MODE === 'send' ? data.id : data.message?.id || data.id
  return { id: String(messageId || ''), mode: SEND_MODE }
}
