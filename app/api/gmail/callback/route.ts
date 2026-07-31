import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  buildGmailOAuthStatusRedirect,
  getStableGmailOAuthCallbackUrl,
  verifyGmailOAuthState,
  type GmailOAuthStatePayload,
} from '@/lib/gmailOAuthUrl'
import { isPro } from '@/lib/plan'

export const dynamic = 'force-dynamic'

const OAUTH_STATE_COOKIE = 'gmail_oauth_state'
const OAUTH_VERIFIER_COOKIE = 'gmail_oauth_verifier'
const OAUTH_RETURN_COOKIE = 'gmail_oauth_return'
const OAUTH_ORIGIN_COOKIE = 'gmail_oauth_origin'

function oauthRedirect(status: string, payload?: GmailOAuthStatePayload | null) {
  return NextResponse.redirect(buildGmailOAuthStatusRedirect(status, payload))
}

function clearOAuthCookies(response: NextResponse) {
  response.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 })
  response.cookies.set(OAUTH_VERIFIER_COOKIE, '', { path: '/', maxAge: 0 })
  response.cookies.set(OAUTH_RETURN_COOKIE, '', { path: '/', maxAge: 0 })
  response.cookies.set(OAUTH_ORIGIN_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}

export async function GET(req: NextRequest) {
  const error = req.nextUrl.searchParams.get('error')
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const payload = verifyGmailOAuthState(state)

  if (!payload) {
    return clearOAuthCookies(oauthRedirect('invalid_state'))
  }
  if (error) return clearOAuthCookies(oauthRedirect('cancelled', payload))
  if (!code) {
    return clearOAuthCookies(oauthRedirect('invalid_state', payload))
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, plan: true },
  })
  if (!currentUser) return clearOAuthCookies(oauthRedirect('user_error', payload))
  if (!isPro(currentUser.plan)) return clearOAuthCookies(oauthRedirect('pro_required', payload))

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return clearOAuthCookies(oauthRedirect('config_error', payload))
  }

  try {
    const redirectUri = getStableGmailOAuthCallbackUrl()
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    })
    const tokens = await tokenResponse.json().catch(() => ({}))

    if (!tokenResponse.ok || typeof tokens.access_token !== 'string') {
      return clearOAuthCookies(oauthRedirect('token_error', payload))
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: 'no-store',
    })
    const profile = await profileResponse.json().catch(() => ({}))
    if (!profileResponse.ok || typeof profile.sub !== 'string') {
      return clearOAuthCookies(oauthRedirect('profile_error', payload))
    }

    const existingAccount = await prisma.googleAccount.findUnique({
      where: { userId: currentUser.id },
      select: { refreshToken: true },
    })
    const refreshToken = typeof tokens.refresh_token === 'string'
      ? tokens.refresh_token
      : existingAccount?.refreshToken || null

    if (!refreshToken) {
      return clearOAuthCookies(oauthRedirect('refresh_token_error', payload))
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

    return clearOAuthCookies(oauthRedirect('connected', payload))
  } catch (error) {
    console.error('Gmail OAuth callback failed:', error)
    return clearOAuthCookies(oauthRedirect('oauth_error', payload))
  }
}
