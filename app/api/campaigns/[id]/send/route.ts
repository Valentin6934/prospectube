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
  hasCompleteCampaignMessage,
  hasValidCampaignEmail,
  isCampaignProspectAlreadyProcessed,
  limitUniqueCampaignSelection,
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
  skippedReason?: 'not_found' | 'no_email' | 'incomplete_message' | 'already_processed'
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

  let accessToken: string
  try {
    accessToken = await getValidGmailAccessToken(user.id)
  } catch (error) {
    const gmailError = error instanceof GmailError ? error : new GmailError('Erreur Gmail.')
    return NextResponse.json(
      { error: gmailError.message, gmailNotConnected: gmailError.status === 400 },
      { status: gmailError.status }
    )
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
    if (!hasValidCampaignEmail(prospect.email)) {
      results.push({
        prospectId: prospect.id,
        success: false,
        status: 'Non envoye',
        error: 'Aucun email disponible.',
        skippedReason: 'no_email',
      })
      continue
    }

    if (!hasCompleteCampaignMessage(prospect)) {
      results.push({
        prospectId: prospect.id,
        success: false,
        status: 'Non envoye',
        error: 'Sujet ou message incomplet.',
        skippedReason: 'incomplete_message',
      })
      continue
    }

    if (isCampaignProspectAlreadyProcessed(prospect)) {
      results.push({
        prospectId: prospect.id,
        success: false,
        status: prospect.sendStatus,
        error: 'Message deja traite.',
        skippedReason: 'already_processed',
      })
      continue
    }

    try {
      const delivery = await deliverGmailMessage(accessToken, {
        to: prospect.email,
        subject: prospect.generatedSubject || `Collaboration avec ${prospect.name}`,
        body: prospect.generatedBody || '',
      })
      const sendStatus = delivery.mode === 'send' ? 'Envoyé' : 'Brouillon créé'
      const sentAt = delivery.mode === 'send' ? new Date() : null

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
              channelEmail: prospect.email,
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

      results.push({ prospectId: prospect.id, success: true, status: sendStatus })
    } catch (error) {
      const message = error instanceof GmailError ? error.message : 'Erreur Gmail.'
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
