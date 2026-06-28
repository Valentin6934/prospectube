import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const OAUTH_STATE_COOKIE = 'gmail_oauth_state'
const OAUTH_VERIFIER_COOKIE = 'gmail_oauth_verifier'

function callbackUrl(req: NextRequest) {
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const host = forwardedHost || req.headers.get('host')
  const protocol = forwardedProto || req.nextUrl.protocol.replace(':', '')
  const origin = host ? `${protocol}://${host}` : req.nextUrl.origin

  return `${origin.replace(/\/$/, '')}/api/gmail/callback`
}

function settingsRedirect(req: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/settings?gmail=${status}`, req.url))
}

function clearOAuthCookies(response: NextResponse) {
  response.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 })
  response.cookies.set(OAUTH_VERIFIER_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return clearOAuthCookies(settingsRedirect(req, 'unauthorized'))
  }

  const error = req.nextUrl.searchParams.get('error')
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const expectedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value
  const verifier = req.cookies.get(OAUTH_VERIFIER_COOKIE)?.value

  if (error) return clearOAuthCookies(settingsRedirect(req, 'cancelled'))
  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return clearOAuthCookies(settingsRedirect(req, 'invalid_state'))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return clearOAuthCookies(settingsRedirect(req, 'config_error'))
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl(req),
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
      cache: 'no-store',
    })
    const tokens = await tokenResponse.json().catch(() => ({}))

    if (!tokenResponse.ok || typeof tokens.access_token !== 'string') {
      return clearOAuthCookies(settingsRedirect(req, 'token_error'))
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: 'no-store',
    })
    const profile = await profileResponse.json().catch(() => ({}))
    if (!profileResponse.ok || typeof profile.sub !== 'string') {
      return clearOAuthCookies(settingsRedirect(req, 'profile_error'))
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) return clearOAuthCookies(settingsRedirect(req, 'user_error'))

    const existingAccount = await prisma.googleAccount.findUnique({
      where: { userId: user.id },
      select: { refreshToken: true },
    })
    const refreshToken = typeof tokens.refresh_token === 'string'
      ? tokens.refresh_token
      : existingAccount?.refreshToken || null

    if (!refreshToken) {
      return clearOAuthCookies(settingsRedirect(req, 'refresh_token_error'))
    }

    await prisma.googleAccount.upsert({
      where: { userId: user.id },
      update: {
        providerAccountId: profile.sub,
        email: typeof profile.email === 'string' ? profile.email : null,
        accessToken: tokens.access_token,
        refreshToken,
        expiryDate: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000),
        scope: typeof tokens.scope === 'string' ? tokens.scope : null,
      },
      create: {
        userId: user.id,
        providerAccountId: profile.sub,
        email: typeof profile.email === 'string' ? profile.email : null,
        accessToken: tokens.access_token,
        refreshToken,
        expiryDate: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000),
        scope: typeof tokens.scope === 'string' ? tokens.scope : null,
      },
    })

    return clearOAuthCookies(settingsRedirect(req, 'connected'))
  } catch (error) {
    console.error('Gmail OAuth callback failed:', error)
    return clearOAuthCookies(settingsRedirect(req, 'oauth_error'))
  }
}
