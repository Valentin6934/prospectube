import { createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { REQUIRED_GMAIL_DRAFT_SCOPE } from '@/lib/gmailStatus'
import { isPro, requireProResponse } from '@/lib/plan'

export const dynamic = 'force-dynamic'

const OAUTH_STATE_COOKIE = 'gmail_oauth_state'
const OAUTH_VERIFIER_COOKIE = 'gmail_oauth_verifier'
const OAUTH_RETURN_COOKIE = 'gmail_oauth_return'
const OAUTH_ORIGIN_COOKIE = 'gmail_oauth_origin'
const OAUTH_COOKIE_MAX_AGE = 10 * 60

function base64Url(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function getRequestOrigin(req: NextRequest) {
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const host = forwardedHost || req.headers.get('host')
  const protocol = forwardedProto || req.nextUrl.protocol.replace(':', '')

  return (host ? `${protocol}://${host}` : req.nextUrl.origin).replace(/\/$/, '')
}

function callbackUrl(req: NextRequest) {
  return `${getRequestOrigin(req)}/api/gmail/callback`
}

function getReturnPath(req: NextRequest) {
  const value = req.nextUrl.searchParams.get('returnTo') || '/settings'
  return value.startsWith('/') && !value.startsWith('//') ? value : '/settings'
}

export async function GET(req: NextRequest) {
  console.log('GET /api/gmail/connect: route entered')
  console.log('GET /api/gmail/connect: NEXTAUTH_URL:', process.env.NEXTAUTH_URL || '(missing)')
  console.log('GET /api/gmail/connect: GOOGLE_CLIENT_ID present:', Boolean(process.env.GOOGLE_CLIENT_ID))

  try {
    const session = await getServerSession(authOptions)
    console.log('GET /api/gmail/connect: session found:', Boolean(session?.user?.email))

    if (!session?.user?.email) {
      const message = 'Session ProspectTube introuvable dans GET /api/gmail/connect.'
      console.error('GET /api/gmail/connect error:', message)
      return NextResponse.json({ error: message }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { plan: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
    }
    if (!isPro(user.plan)) return requireProResponse()

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
    if (!clientId) {
      const message = 'GOOGLE_CLIENT_ID est absent des variables d’environnement.'
      console.error('GET /api/gmail/connect error:', message)
      return NextResponse.json({ error: message }, { status: 500 })
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
        REQUIRED_GMAIL_DRAFT_SCOPE,
      ].join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString()

    console.log('GET /api/gmail/connect: OAuth URL generated:', authorizationUrl.toString())

    const response = NextResponse.redirect(authorizationUrl, { status: 302 })
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: OAUTH_COOKIE_MAX_AGE,
    }
    response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions)
    response.cookies.set(OAUTH_VERIFIER_COOKIE, verifier, cookieOptions)
    response.cookies.set(OAUTH_RETURN_COOKIE, getReturnPath(req), cookieOptions)
    response.cookies.set(OAUTH_ORIGIN_COOKIE, getRequestOrigin(req), cookieOptions)

    console.log('GET /api/gmail/connect: redirecting to Google with status 302')
    return response
  } catch (error) {
    console.error('GET /api/gmail/connect error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
