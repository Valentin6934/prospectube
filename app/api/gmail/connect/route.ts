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
import { canUseGmailIntegration } from '@/lib/campaignAccess'
import { getSafeGmailOAuthMessage, logSafeGmailOAuthFailure } from '@/lib/gmailOAuthErrors'

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

    if (!(await canUseGmailIntegration(prisma, user))) {
      return NextResponse.json({
        error: 'FREE_CAMPAIGN_COMPLETED',
        upgrade: true,
        message: 'Votre campagne d’essai est terminée. Passez au Plan Pro pour reconnecter Gmail.',
      }, { status: 403 })
    }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
    if (!clientId) {
      logSafeGmailOAuthFailure({ code: 'OAUTH_NOT_CONFIGURED', step: 'configuration' })
      return NextResponse.json({
        error: 'OAUTH_NOT_CONFIGURED',
        message: getSafeGmailOAuthMessage('OAUTH_NOT_CONFIGURED'),
      }, { status: 503 })
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
    logSafeGmailOAuthFailure({ code: 'GMAIL_INTERNAL_ERROR', step: 'authorization_url', error })
    return NextResponse.json({
      error: 'GMAIL_INTERNAL_ERROR',
      message: getSafeGmailOAuthMessage('GMAIL_INTERNAL_ERROR'),
    }, { status: 500 })
  }
}
