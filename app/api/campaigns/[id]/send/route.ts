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

export const dynamic = 'force-dynamic'

const MAX_BATCH_SIZE = 20

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
}

function hasValidEmail(email: string | null): email is string {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const requestedIds: string[] = Array.isArray(body.prospectIds)
    ? body.prospectIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    : []
  const prospectIds = Array.from(new Set(requestedIds)).slice(0, MAX_BATCH_SIZE)

  if (prospectIds.length === 0) {
    return NextResponse.json({ error: 'Sélectionnez au moins un prospect.' }, { status: 400 })
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

  const results: Array<{
    prospectId: string
    success: boolean
    status: string
    error?: string
  }> = []

  for (const prospect of campaign.prospects) {
    if (!hasValidEmail(prospect.email)) {
      results.push({
        prospectId: prospect.id,
        success: false,
        status: 'Non envoyé',
        error: 'Aucun email disponible.',
      })
      continue
    }

    if (!prospect.generatedBody) {
      results.push({
        prospectId: prospect.id,
        success: false,
        status: 'Non envoyé',
        error: 'Aucun message IA disponible.',
      })
      continue
    }

    if (prospect.sendStatus === 'Envoyé') {
      results.push({
        prospectId: prospect.id,
        success: false,
        status: 'Envoyé',
        error: 'Message déjà envoyé.',
      })
      continue
    }

    try {
      const delivery = await deliverGmailMessage(accessToken, {
        to: prospect.email,
        subject: prospect.generatedSubject || `Collaboration avec ${prospect.name}`,
        body: prospect.generatedBody,
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
              content: prospect.generatedBody,
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

  const successCount = results.filter(result => result.success).length
  const errorCount = results.length - successCount

  return NextResponse.json({
    results,
    successCount,
    errorCount,
    mode: SEND_MODE,
    limited: requestedIds.length > MAX_BATCH_SIZE,
  })
}
