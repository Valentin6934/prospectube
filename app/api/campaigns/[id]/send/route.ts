import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  deliverGmailMessage,
  getValidGmailAccessToken,
  GmailError,
  SEND_MODE,
} from '@/lib/gmail'
import { isPro, requireProResponse } from '@/lib/plan'
import { FREE_CAMPAIGN_PROSPECT_LIMIT, canUseFreeCampaign, freeCampaignLimitResponse } from '@/lib/campaignAccess'
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
  gmailMessageId?: string
  gmailDraftId?: string
  prismaCode?: string
  prismaMessage?: string
  failingOperation?: string
  skippedReason?: CampaignSkipReason
}

type CampaignDeliveryProspect = {
  id: string
  name: string
  email: string | null
  generatedBody: string | null
}

type GmailDeliveryResult = {
  id: string
  mode: 'draft' | 'send'
}

function toGmailDeliveryResult(delivery: { id: string; mode: string }): GmailDeliveryResult {
  return {
    id: delivery.id,
    mode: delivery.mode === 'send' ? 'send' : 'draft',
  }
}

function getFunctionalGmailCode(error: GmailError) {
  if (error.code === 'missing_account') return 'GMAIL_NOT_CONNECTED'
  if (['missing_refresh_token', 'invalid_refresh_token', 'revoked_access', 'access_token_expired'].includes(error.code)) return 'GMAIL_CONNECTION_EXPIRED'
  if (error.code === 'google_temporary') return 'GMAIL_TEMPORARY_ERROR'
  if (error.code === 'oauth_config') return 'GMAIL_OAUTH_CONFIG'
  if (error.code === 'scope_missing') return 'GMAIL_SCOPE_MISSING'
  if (error.code === 'api_not_enabled') return 'GMAIL_API_NOT_ENABLED'
  if (error.code === 'rate_limited') return 'GMAIL_RATE_LIMITED'
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
  return 'Sujet ou message a completer.'
}

function getStructuredDraftState(results: SendResult[]) {
  return {
    created: results.filter(result => result.code === 'DRAFT_CREATED' || result.code === 'DRAFT_CREATED_STATUS_RECOVERED'),
    alreadyCreated: results.filter(result => result.code === 'DRAFT_ALREADY_CREATED'),
    statusSaveFailed: results.filter(result => result.code === 'DRAFT_CREATED_STATUS_NOT_SAVED'),
    failed: results.filter(result => !result.success && !result.skippedReason),
  }
}

function getPrismaErrorDetails(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      prismaCode: error.code,
      prismaMessage: error.message,
      prismaMeta: error.meta || null,
      stack: error.stack || null,
    }
  }

  if (error instanceof Error) {
    return {
      prismaCode: null,
      prismaMessage: error.message,
      prismaMeta: null,
      stack: error.stack || null,
    }
  }

  return {
    prismaCode: null,
    prismaMessage: String(error),
    prismaMeta: null,
    stack: null,
  }
}

function logCampaignStatusPersistFailure(input: {
  campaignId: string
  prospectId: string
  userId: string
  gmailDraftId: string | null
  gmailMessageId: string | null
  failingOperation: string
  prismaQuery: unknown
  prospectBelongsToCampaign: boolean
  error: unknown
}) {
  const details = getPrismaErrorDetails(input.error)
  console.error('POST /api/campaigns/[id]/send Prisma status persist failed:', {
    campaignId: input.campaignId,
    prospectId: input.prospectId,
    userId: input.userId,
    gmailDraftId: input.gmailDraftId,
    gmailMessageId: input.gmailMessageId,
    prospectBelongsToCampaign: input.prospectBelongsToCampaign,
    failingOperation: input.failingOperation,
    prismaQuery: input.prismaQuery,
    prismaCode: details.prismaCode,
    prismaMessage: details.prismaMessage,
    prismaMeta: details.prismaMeta,
    stack: details.stack,
  })
}

async function persistCampaignDeliveryStatus(input: {
  campaignId: string
  userId: string
  prospect: CampaignDeliveryProspect
  delivery: GmailDeliveryResult
  sendStatus: string
  sentAt: Date | null
}) {
  const gmailMessageId = input.delivery.id
  const gmailDraftId = input.delivery.mode === 'draft' ? input.delivery.id : null
  const prospectBelongsToCampaign = true
  const richUpdateQuery = {
    where: {
      id: input.prospect.id,
      campaignId: input.campaignId,
    },
    data: {
      sendStatus: input.sendStatus,
      sentAt: input.sentAt,
      sendError: null,
      gmailMessageId,
    },
  }

  try {
    const result = await prisma.campaignProspect.updateMany(richUpdateQuery)
    if (result.count !== 1) {
      throw new Prisma.PrismaClientKnownRequestError(
        'CampaignProspect status update matched no row for the current campaign.',
        {
          code: 'P2025',
          clientVersion: Prisma.prismaVersion.client,
          meta: { campaignId: input.campaignId, prospectId: input.prospect.id, count: result.count },
        }
      )
    }

    if (input.delivery.mode === 'send') {
      await prisma.emailSent.create({
        data: {
          userId: input.userId,
          channelName: input.prospect.name,
          channelEmail: input.prospect.email as string,
          content: input.prospect.generatedBody || '',
          status: 'Envoyé',
        },
      })
    }

    return { recovered: false }
  } catch (error) {
    logCampaignStatusPersistFailure({
      campaignId: input.campaignId,
      prospectId: input.prospect.id,
      userId: input.userId,
      gmailDraftId,
      gmailMessageId,
      prospectBelongsToCampaign,
      failingOperation: 'campaignProspect.updateMany.deliveryStatusFull',
      prismaQuery: richUpdateQuery,
      error,
    })

    const minimalUpdateQuery = {
      where: {
        id: input.prospect.id,
        campaignId: input.campaignId,
      },
      data: {
        sendStatus: input.sendStatus,
        gmailMessageId,
      },
    }

    try {
      const result = await prisma.campaignProspect.updateMany(minimalUpdateQuery)
      if (result.count !== 1) {
        throw new Prisma.PrismaClientKnownRequestError(
          'CampaignProspect minimal status update matched no row for the current campaign.',
          {
            code: 'P2025',
            clientVersion: Prisma.prismaVersion.client,
            meta: { campaignId: input.campaignId, prospectId: input.prospect.id, count: result.count },
          }
        )
      }

      return { recovered: true }
    } catch (fallbackError) {
      logCampaignStatusPersistFailure({
        campaignId: input.campaignId,
        prospectId: input.prospect.id,
        userId: input.userId,
        gmailDraftId,
        gmailMessageId,
        prospectBelongsToCampaign,
        failingOperation: 'campaignProspect.updateMany.deliveryStatusMinimal',
        prismaQuery: minimalUpdateQuery,
        error: fallbackError,
      })

      const details = getPrismaErrorDetails(fallbackError)
      return {
        recovered: false,
        failed: true,
        prismaCode: details.prismaCode || undefined,
        prismaMessage: details.prismaMessage,
        failingOperation: 'campaignProspect.updateMany.deliveryStatusMinimal',
      }
    }
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecte' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const requestedIds: string[] = Array.isArray(body.prospectIds)
    ? body.prospectIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    : []
  const prospectIds = limitUniqueCampaignSelection(requestedIds).slice(0, isPro(user.plan) ? CAMPAIGN_SEND_LIMIT : FREE_CAMPAIGN_PROSPECT_LIMIT)

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
          gmailMessageId: true,
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
      const alreadyProcessed = skippedReason === 'already_processed'
      results.push({
        prospectId: prospect.id,
        success: false,
        status: alreadyProcessed ? prospect.sendStatus || 'Brouillon cree' : 'Non envoye',
        error: alreadyProcessed ? undefined : getSkipMessage(skippedReason),
        code: alreadyProcessed ? 'DRAFT_ALREADY_CREATED' : undefined,
        gmailMessageId: alreadyProcessed ? prospect.gmailMessageId || undefined : undefined,
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
      ...getStructuredDraftState(results),
      ...summary,
      mode: SEND_MODE,
      limited: requestedIds.length > CAMPAIGN_SEND_LIMIT,
      message: results.some(result => result.code === 'DRAFT_ALREADY_CREATED')
        ? 'Tous les brouillons eligibles existent deja.'
        : 'Aucun prospect eligible. Verifiez email, sujet et message.',
    })
  }
  if (!isPro(user.plan) && !(await canUseFreeCampaign(prisma, user.id, campaign.id))) return freeCampaignLimitResponse()

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
      let delivery: GmailDeliveryResult
      try {
        delivery = toGmailDeliveryResult(await deliverGmailMessage(accessToken, messagePayload))
      } catch (error) {
        if (error instanceof GmailError && error.code === 'access_token_expired') {
          accessToken = await getValidGmailAccessToken(user.id, { forceRefresh: true })
          delivery = toGmailDeliveryResult(await deliverGmailMessage(accessToken, messagePayload))
        } else {
          throw error
        }
      }
      const sendStatus = delivery.mode === 'send' ? 'Envoyé' : 'Brouillon créé'
      const sentAt = delivery.mode === 'send' ? new Date() : null

      const persistResult = await persistCampaignDeliveryStatus({
        campaignId: campaign.id,
        userId: user.id,
        prospect,
        delivery,
        sendStatus,
        sentAt,
      })

      if (persistResult.failed) {
        results.push({
          prospectId: prospect.id,
          success: true,
          status: sendStatus,
          error: 'Le brouillon a ete cree dans Gmail, mais le statut n’a pas pu etre enregistre dans ProspectTube.',
          code: 'DRAFT_CREATED_STATUS_NOT_SAVED',
          gmailMessageId: delivery.id,
          gmailDraftId: delivery.mode === 'draft' ? delivery.id : undefined,
          prismaCode: persistResult.prismaCode,
          prismaMessage: persistResult.prismaMessage,
          failingOperation: persistResult.failingOperation,
        })
        continue
      }

      results.push({
        prospectId: prospect.id,
        success: true,
        status: sendStatus,
        code: persistResult.recovered ? 'DRAFT_CREATED_STATUS_RECOVERED' : 'DRAFT_CREATED',
        gmailMessageId: delivery.id,
        gmailDraftId: delivery.mode === 'draft' ? delivery.id : undefined,
      })
    } catch (error) {
      const message = error instanceof GmailError ? error.message : 'Google Gmail a refusé la requête.'
      await prisma.campaignProspect.update({
        where: { id: prospect.id },
        data: {
          sendStatus: 'Erreur',
          sendError: message,
        },
      }).catch(updateError => {
        console.error('POST /api/campaigns/[id]/send error status persist failed:', {
          campaignId: params.id,
          prospectId: prospect.id,
          userId: user.id,
          updateError,
        })
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
    ...getStructuredDraftState(results),
    ...summary,
    mode: SEND_MODE,
    limited: requestedIds.length > CAMPAIGN_SEND_LIMIT,
  })
}
