import { prisma } from '@/lib/prisma'
import { getSafeGmailErrorMessage } from '@/lib/gmailStatus'

export const SEND_MODE = process.env.GMAIL_SEND_MODE === 'send' ? 'send' : 'draft'

export type GmailErrorCode =
  | 'missing_account'
  | 'missing_refresh_token'
  | 'invalid_refresh_token'
  | 'revoked_access'
  | 'oauth_config'
  | 'google_temporary'
  | 'delivery_error'

export class GmailError extends Error {
  constructor(message: string, public status = 500, public code: GmailErrorCode = 'delivery_error') {
    super(message)
    this.name = 'GmailError'
  }
}

type GmailMessage = {
  to: string
  subject: string
  body: string
}

function encodeSubject(subject: string) {
  const cleanSubject = subject.replace(/[\r\n]+/g, ' ').trim()
  return `=?UTF-8?B?${Buffer.from(cleanSubject, 'utf8').toString('base64')}?=`
}

function encodeMessage({ to, subject, body }: GmailMessage) {
  const cleanRecipient = to.replace(/[\r\n]+/g, '').trim()
  const mime = [
    `To: ${cleanRecipient}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
  ].join('\r\n')

  return Buffer.from(mime, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
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

export async function getValidGmailAccessToken(userId: string) {
  const account = await prisma.googleAccount.findUnique({ where: { userId } })
  if (!account) throw new GmailError(getSafeGmailErrorMessage('missing_account'), 400, 'missing_account')

  const tokenIsValid = account.expiryDate
    ? account.expiryDate.getTime() > Date.now() + 60_000
    : true

  if (tokenIsValid) return account.accessToken
  if (!account.refreshToken) {
    throw new GmailError(getSafeGmailErrorMessage('missing_refresh_token'), 401, 'missing_refresh_token')
  }

  return refreshAccessToken(userId, account.refreshToken)
}

export async function deliverGmailMessage(accessToken: string, message: GmailMessage) {
  const raw = encodeMessage(message)
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
    const reason = data?.error?.message
    throw new GmailError(
      typeof reason === 'string' ? `Erreur Gmail : ${reason}` : 'Erreur Gmail lors de l’envoi.',
      response.status,
      'delivery_error'
    )
  }

  const messageId = SEND_MODE === 'send' ? data.id : data.message?.id || data.id
  return { id: String(messageId || ''), mode: SEND_MODE }
}
