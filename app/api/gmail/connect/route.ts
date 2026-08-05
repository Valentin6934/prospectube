import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { REQUIRED_GMAIL_DRAFT_SCOPE } from '@/lib/gmailStatus'
import {
  createGmailOAuthState,
  getRequestOriginFromParts,
  getSafeGmailOAuthReturnPath,
  getStableGmailOAuthCallbackUrl,
} from '@/lib/gmailOAuthUrl'
import { isPro, requireProResponse } from '@/lib/plan'

export const dynamic = 'force-dynamic'

function getRequestOrigin(req: NextRequest) {
  return getRequestOriginFromParts({
    forwardedHost: req.headers.get('x-forwarded-host'),
    forwardedProto: req.headers.get('x-forwarded-proto'),
    host: req.headers.get('host'),
    fallbackOrigin: req.nextUrl.origin,
  })
}

function getReturnPath(req: NextRequest) {
  return getSafeGmailOAuthReturnPath(req.nextUrl.searchParams.get('returnTo') || '/settings')
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      const message = 'Session ProspectTube introuvable dans GET /api/gmail/connect.'
      console.error('GET /api/gmail/connect error:', message)
      return NextResponse.json({ error: message }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, plan: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
    }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
    if (!clientId) {
      const message = 'GOOGLE_CLIENT_ID est absent des variables d’environnement.'
      console.error('GET /api/gmail/connect error:', message)
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const state = createGmailOAuthState({
      userId: user.id,
      origin: getRequestOrigin(req),
      returnPath: getReturnPath(req),
    })
    const redirectUri = getStableGmailOAuthCallbackUrl()
    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')

    authorizationUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
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
    }).toString()

    const response = NextResponse.redirect(authorizationUrl, { status: 302 })

    return response
  } catch (error) {
    console.error('GET /api/gmail/connect error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
