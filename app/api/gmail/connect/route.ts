import { createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const OAUTH_STATE_COOKIE = 'gmail_oauth_state'
const OAUTH_VERIFIER_COOKIE = 'gmail_oauth_verifier'
const OAUTH_COOKIE_MAX_AGE = 10 * 60

function base64Url(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function callbackUrl(req: NextRequest) {
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const host = forwardedHost || req.headers.get('host')
  const protocol = forwardedProto || req.nextUrl.protocol.replace(':', '')
  const origin = host ? `${protocol}://${host}` : req.nextUrl.origin

  return `${origin.replace(/\/$/, '')}/api/gmail/callback`
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/settings?gmail=unauthorized', req.url))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(new URL('/settings?gmail=config_error', req.url))
  }

  const state = base64Url(randomBytes(32))
  const verifier = base64Url(randomBytes(64))
  const challenge = base64Url(createHash('sha256').update(verifier).digest())
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')

  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl(req),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
    ].join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString()

  const response = NextResponse.redirect(authorizationUrl)
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: OAUTH_COOKIE_MAX_AGE,
  }
  response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions)
  response.cookies.set(OAUTH_VERIFIER_COOKIE, verifier, cookieOptions)

  return response
}
