import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPro } from '@/lib/plan'

export const dynamic = 'force-dynamic'

const OAUTH_STATE_COOKIE = 'gmail_oauth_state'
const OAUTH_VERIFIER_COOKIE = 'gmail_oauth_verifier'
const OAUTH_RETURN_COOKIE = 'gmail_oauth_return'
const OAUTH_ORIGIN_COOKIE = 'gmail_oauth_origin'

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

function safeReturnPath(req: NextRequest) {
  const value = req.cookies.get(OAUTH_RETURN_COOKIE)?.value || '/settings'
  return value.startsWith('/') && !value.startsWith('//') ? value : '/settings'
}

function oauthRedirect(req: NextRequest, status: string) {
  const returnPath = safeReturnPath(req)
  const separator = returnPath.includes('?') ? '&' : '?'
  return NextResponse.redirect(new URL(`${returnPath}${separator}gmail=${status}`, getSafeReturnOrigin(req)))
}

function clearOAuthCookies(response: NextResponse) {
  response.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 })
  response.cookies.set(OAUTH_VERIFIER_COOKIE, '', { path: '/', maxAge: 0 })
  response.cookies.set(OAUTH_RETURN_COOKIE, '', { path: '/', maxAge: 0 })
  response.cookies.set(OAUTH_ORIGIN_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}

function getSafeReturnOrigin(req: NextRequest) {
  const currentOrigin = getRequestOrigin(req)
  const storedOrigin = req.cookies.get(OAUTH_ORIGIN_COOKIE)?.value
  if (!storedOrigin) return currentOrigin

  try {
    const url = new URL(storedOrigin)
    const current = new URL(currentOrigin)
    const isHttp = url.protocol === 'https:' || url.protocol === 'http:'
    const isSameHost = url.host === current.host
    const isVercelPreview = url.hostname.endsWith('.vercel.app')
    const isLocalDev = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname)

    if (isHttp && (isSameHost || isVercelPreview || isLocalDev)) {
      return url.origin
    }
  } catch {
    return currentOrigin
  }

  return currentOrigin
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return clearOAuthCookies(oauthRedirect(req, 'unauthorized'))
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, plan: true },
  })
  if (!currentUser) return clearOAuthCookies(oauthRedirect(req, 'user_error'))
  if (!isPro(currentUser.plan)) return clearOAuthCookies(oauthRedirect(req, 'pro_required'))

  const error = req.nextUrl.searchParams.get('error')
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const expectedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value
  const verifier = req.cookies.get(OAUTH_VERIFIER_COOKIE)?.value

  if (error) return clearOAuthCookies(oauthRedirect(req, 'cancelled'))
  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return clearOAuthCookies(oauthRedirect(req, 'invalid_state'))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return clearOAuthCookies(oauthRedirect(req, 'config_error'))
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
      return clearOAuthCookies(oauthRedirect(req, 'token_error'))
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: 'no-store',
    })
    const profile = await profileResponse.json().catch(() => ({}))
    if (!profileResponse.ok || typeof profile.sub !== 'string') {
      return clearOAuthCookies(oauthRedirect(req, 'profile_error'))
    }

    const existingAccount = await prisma.googleAccount.findUnique({
      where: { userId: currentUser.id },
      select: { refreshToken: true },
    })
    const refreshToken = typeof tokens.refresh_token === 'string'
      ? tokens.refresh_token
      : existingAccount?.refreshToken || null

    if (!refreshToken) {
      return clearOAuthCookies(oauthRedirect(req, 'refresh_token_error'))
    }

    await prisma.googleAccount.upsert({
      where: { userId: currentUser.id },
      update: {
        providerAccountId: profile.sub,
        email: typeof profile.email === 'string' ? profile.email : null,
        accessToken: tokens.access_token,
        refreshToken,
        expiryDate: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000),
        scope: typeof tokens.scope === 'string' ? tokens.scope : null,
      },
      create: {
        userId: currentUser.id,
        providerAccountId: profile.sub,
        email: typeof profile.email === 'string' ? profile.email : null,
        accessToken: tokens.access_token,
        refreshToken,
        expiryDate: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000),
        scope: typeof tokens.scope === 'string' ? tokens.scope : null,
      },
    })

    return clearOAuthCookies(oauthRedirect(req, 'connected'))
  } catch (error) {
    console.error('Gmail OAuth callback failed:', error)
    return clearOAuthCookies(oauthRedirect(req, 'oauth_error'))
  }
}
