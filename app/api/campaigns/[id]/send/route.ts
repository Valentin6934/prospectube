import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  deliverGmailMessage,
  getValidGmailAccessToken,
  GmailError,
  SEND_MODE,
} from '@/lib/gmail'
import { isPro, requireProResponse } from '@/lib/plan'
import {
  CAMPAIGN_SEND_LIMIT,
  getCampaignSendSummary,
  getCampaignProspectSkipReason,
  limitUniqueCampaignSelection,
  type CampaignSkipReason,
} from '@/lib/campaignWorkflow'

export const dynamic = 'force-dynamic'

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, plan: true },
  })
}

type SendResult = {
  prospectId: string
  success: boolean
  status: string
  error?: string
  code?: string
  skippedReason?: CampaignSkipReason
}

function getFunctionalGmailCode(error: GmailError) {
  if (error.code === 'missing_account') return 'GMAIL_NOT_CONNECTED'
  if (['missing_refresh_token', 'invalid_refresh_token', 'revoked_access', 'access_token_expired'].includes(error.code)) return 'GMAIL_CONNECTION_EXPIRED'
  if (error.code === 'google_temporary') return 'GMAIL_TEMPORARY_ERROR'
  if (error.code === 'oauth_config') return 'GMAIL_OAUTH_CONFIG'
  if (error.code === 'scope_missing') return 'GMAIL_SCOPE_MISSING'
  if (error.code === 'draft_invalid') return 'GMAIL_DRAFT_INVALID'
  if (error.code === 'status_persist_failed') return 'GMAIL_STATUS_PERSIST_FAILED'
  return 'GMAIL_API_REJECTED'
}

function getSkipMessage(reason: CampaignSkipReason): string {
  if (reason === 'no_email') return 'Aucun email disponible.'
  if (reason === 'no_subject') return 'Sujet manquant.'
  if (reason === 'no_body') return 'Message manquant.'
  if (reason === 'already_processed') return 'Message deja traite.'
  if (reason === 'not_found') return 'Prospect introuvable dans cette campagne.'
  return 'Sujet ou message incomplet.'
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecte' }, { status: 401 })
  if (!isPro(user.plan)) return requireProResponse()

  const body = await req.json().catch(() => ({}))
  const requestedIds: string[] = Array.isArray(body.prospectIds)
    ? body.prospectIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    : []
  const prospectIds = limitUniqueCampaignSelection(requestedIds)

  if (prospectIds.length === 0) {
    return NextResponse.json({ error: 'Selectionnez au moins un prospect.' }, { status: 400 })
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      prospects: {
        where: { id: { in: prospectIds } },
        select: {
          id: true,
          name: true,
          email: true,
          generatedSubject: true,
          generatedBody: true,
          sendStatus: true,
        },
      },
    },
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
  }

  const foundIds = new Set(campaign.prospects.map(prospect => prospect.id))
  const results: SendResult[] = prospectIds
    .filter(id => !foundIds.has(id))
    .map(id => ({
      prospectId: id,
      success: false,
      status: 'Ignore',
      error: 'Prospect introuvable dans cette campagne.',
      skippedReason: 'not_found',
    }))

  for (const prospect of campaign.prospects) {
    const skippedReason = getCampaignProspectSkipReason(prospect)
    if (skippedReason) {
      results.push({
        prospectId: prospect.id,
        success: false,
        status: skippedReason === 'already_processed' ? prospect.sendStatus : 'Non envoye',
        error: getSkipMessage(skippedReason),
        skippedReason,
      })
    }
  }

  const eligibleProspects = campaign.prospects.filter(prospect =>
    getCampaignProspectSkipReason(prospect) === null
  )

  if (eligibleProspects.length === 0) {
    const summary = getCampaignSendSummary(results)
    return NextResponse.json({
      results,
      ...summary,
      mode: SEND_MODE,
      limited: requestedIds.length > CAMPAIGN_SEND_LIMIT,
      message: 'Aucun prospect eligible. Verifiez email, sujet et message.',
    })
  }

  let accessToken: string
  try {
    accessToken = await getValidGmailAccessToken(user.id)
  } catch (error) {
    const gmailError = error instanceof GmailError ? error : new GmailError('Google Gmail a refusé la requête.', 500, 'api_rejected')
    return NextResponse.json(
      {
        error: gmailError.message,
        functionalCode: getFunctionalGmailCode(gmailError),
        gmailNotConnected: gmailError.code === 'missing_account',
        gmailExpired: ['missing_refresh_token', 'invalid_refresh_token', 'revoked_access', 'access_token_expired'].includes(gmailError.code),
        reconnectRequired: ['missing_refresh_token', 'invalid_refresh_token', 'revoked_access', 'access_token_expired'].includes(gmailError.code),
        code: gmailError.code,
      },
      { status: gmailError.status }
    )
  }

  for (const prospect of eligibleProspects) {
    try {
      const email = prospect.email as string
      const messagePayload = {
        to: email,
        subject: prospect.generatedSubject || `Collaboration avec ${prospect.name}`,
        body: prospect.generatedBody || '',
      }
      let delivery
      try {
        delivery = await deliverGmailMessage(accessToken, messagePayload)
      } catch (error) {
        if (error instanceof GmailError && error.code === 'access_token_expired') {
          accessToken = await getValidGmailAccessToken(user.id, { forceRefresh: true })
          delivery = await deliverGmailMessage(accessToken, messagePayload)
        } else {
          throw error
        }
      }
      const sendStatus = delivery.mode === 'send' ? 'Envoyé' : 'Brouillon créé'
      const sentAt = delivery.mode === 'send' ? new Date() : null

      try {
        if (delivery.mode === 'send') {
          await prisma.$transaction([
            prisma.campaignProspect.update({
              where: { id: prospect.id },
              data: {
                sendStatus,
                sentAt,
                sendError: null,
                gmailMessageId: delivery.id,
              },
            }),
            prisma.emailSent.create({
              data: {
                userId: user.id,
                channelName: prospect.name,
                channelEmail: email,
                content: prospect.generatedBody || '',
                status: 'Envoyé',
              },
            }),
          ])
        } else {
          await prisma.campaignProspect.update({
            where: { id: prospect.id },
            data: {
              sendStatus,
              sentAt: null,
              sendError: null,
              gmailMessageId: delivery.id,
            },
          })
        }
      } catch {
        throw new GmailError('Le brouillon a été créé dans Gmail, mais le statut n’a pas pu être enregistré.', 500, 'status_persist_failed')
      }

      results.push({ prospectId: prospect.id, success: true, status: sendStatus })
    } catch (error) {
      const message = error instanceof GmailError ? error.message : 'Google Gmail a refusé la requête.'
      await prisma.campaignProspect.update({
        where: { id: prospect.id },
        data: {
          sendStatus: 'Erreur',
          sendError: message,
        },
      })
      results.push({
        prospectId: prospect.id,
        success: false,
        status: 'Erreur',
        error: message,
        code: error instanceof GmailError ? getFunctionalGmailCode(error) : 'GMAIL_API_REJECTED',
      })
    }
  }

  const summary = getCampaignSendSummary(results)

  return NextResponse.json({
    results,
    ...summary,
    mode: SEND_MODE,
    limited: requestedIds.length > CAMPAIGN_SEND_LIMIT,
  })
}
