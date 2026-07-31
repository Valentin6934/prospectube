import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const PRODUCTION_ORIGIN = 'https://prospectube.vercel.app'
const LOCAL_ORIGIN = 'http://localhost:3000'
const CALLBACK_PATH = '/api/gmail/callback'
const STATE_MAX_AGE_MS = 10 * 60 * 1000

export type GmailOAuthEnv = Partial<Pick<NodeJS.ProcessEnv, 'APP_URL' | 'NEXTAUTH_URL' | 'NEXTAUTH_SECRET' | 'AUTH_SECRET' | 'NODE_ENV'>>

export type GmailOAuthStatePayload = {
  nonce: string
  userId: string
  origin: string
  returnPath: string
  iat: number
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  return Buffer.from(padded, 'base64').toString('utf8')
}

function normalizeOrigin(value?: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.origin.replace(/\/$/, '')
  } catch {
    return null
  }
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    return url.protocol === 'http:' && url.hostname === 'localhost' && url.port === '3000'
  } catch {
    return false
  }
}

function isStableProductionOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    return url.protocol === 'https:' && url.hostname === 'prospectube.vercel.app'
  } catch {
    return false
  }
}

function isProspectTubeVercelPreviewOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.vercel.app') &&
      /^prospectube-[a-z0-9-]+\.vercel\.app$/i.test(url.hostname)
    )
  } catch {
    return false
  }
}

export function isAllowedProspectTubeReturnOrigin(origin?: string | null, env: GmailOAuthEnv = process.env): boolean {
  const normalized = normalizeOrigin(origin)
  if (!normalized) return false
  if (isStableProductionOrigin(normalized)) return true
  if (isProspectTubeVercelPreviewOrigin(normalized)) return true
  return env.NODE_ENV !== 'production' && isLocalhostOrigin(normalized)
}

export function getStableGmailOAuthOrigin(env: GmailOAuthEnv = process.env): string {
  const explicitOrigin = normalizeOrigin(env.APP_URL) || normalizeOrigin(env.NEXTAUTH_URL)
  if (explicitOrigin && isStableProductionOrigin(explicitOrigin)) return explicitOrigin
  if (env.NODE_ENV !== 'production' && explicitOrigin && isLocalhostOrigin(explicitOrigin)) return explicitOrigin
  if (env.NODE_ENV !== 'production') return LOCAL_ORIGIN
  return PRODUCTION_ORIGIN
}

export function getStableGmailOAuthCallbackUrl(env: GmailOAuthEnv = process.env): string {
  return `${getStableGmailOAuthOrigin(env)}${CALLBACK_PATH}`
}

export function getRequestOriginFromParts(parts: {
  forwardedHost?: string | null
  forwardedProto?: string | null
  host?: string | null
  fallbackOrigin: string
}): string {
  const forwardedHost = parts.forwardedHost?.split(',')[0]?.trim()
  const forwardedProto = parts.forwardedProto?.split(',')[0]?.trim()
  const host = forwardedHost || parts.host
  const protocol = forwardedProto || normalizeOrigin(parts.fallbackOrigin)?.split('://')[0] || 'https'
  return normalizeOrigin(host ? `${protocol}://${host}` : parts.fallbackOrigin) || PRODUCTION_ORIGIN
}

export function getSafeGmailOAuthReturnPath(value?: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/settings'
  try {
    const url = new URL(value, PRODUCTION_ORIGIN)
    return `${url.pathname}${url.search}`
  } catch {
    return '/settings'
  }
}

function getStateSecret(env: GmailOAuthEnv) {
  const secret = env.NEXTAUTH_SECRET || env.AUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET est requis pour signer le state OAuth Gmail.')
  }
  return secret
}

function signStatePayload(payload: string, env: GmailOAuthEnv) {
  return base64UrlEncode(createHmac('sha256', getStateSecret(env)).update(payload).digest())
}

export function createGmailOAuthState(
  input: { userId: string; origin: string; returnPath: string },
  env: GmailOAuthEnv = process.env
): string {
  const origin = normalizeOrigin(input.origin)
  if (!isAllowedProspectTubeReturnOrigin(origin, env)) {
    throw new Error('Origine de retour Gmail non autorisee.')
  }

  const payload: GmailOAuthStatePayload = {
    nonce: base64UrlEncode(randomBytes(24)),
    userId: input.userId,
    origin: origin as string,
    returnPath: getSafeGmailOAuthReturnPath(input.returnPath),
    iat: Date.now(),
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  return `${encodedPayload}.${signStatePayload(encodedPayload, env)}`
}

export function verifyGmailOAuthState(
  state?: string | null,
  env: GmailOAuthEnv = process.env,
  now = Date.now()
): GmailOAuthStatePayload | null {
  if (!state) return null
  const [encodedPayload, signature] = state.split('.')
  if (!encodedPayload || !signature) return null

  const expected = signStatePayload(encodedPayload, env)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as GmailOAuthStatePayload
    if (!payload.userId || !payload.origin || !payload.returnPath || !payload.iat || !payload.nonce) return null
    if (now - payload.iat > STATE_MAX_AGE_MS || payload.iat - now > 60_000) return null
    if (!isAllowedProspectTubeReturnOrigin(payload.origin, env)) return null
    return {
      ...payload,
      origin: normalizeOrigin(payload.origin) as string,
      returnPath: getSafeGmailOAuthReturnPath(payload.returnPath),
    }
  } catch {
    return null
  }
}

export function buildGmailOAuthStatusRedirect(
  status: string,
  payload?: Pick<GmailOAuthStatePayload, 'origin' | 'returnPath'> | null,
  env: GmailOAuthEnv = process.env
): URL {
  const origin = payload && isAllowedProspectTubeReturnOrigin(payload.origin, env)
    ? payload.origin
    : getStableGmailOAuthOrigin(env)
  const returnPath = getSafeGmailOAuthReturnPath(payload?.returnPath)
  const url = new URL(returnPath, origin)
  url.searchParams.set('gmail', status)
  return url
}
