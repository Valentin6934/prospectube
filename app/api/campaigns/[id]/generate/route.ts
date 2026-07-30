import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import Anthropic from '@anthropic-ai/sdk'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPro, requireProResponse } from '@/lib/plan'
import { buildCampaignAiPrompt, getCampaignAiConfigError, parseCampaignAiText } from '@/lib/campaignMessaging'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MAX_BATCH_SIZE = 20

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, plan: true },
  })
}

type ProspectForGeneration = {
  id: string
  name: string
  email: string | null
  instagram: string | null
  tiktok: string | null
  twitch: string | null
  website: string | null
  channelUrl: string | null
  score: number | null
  scoreLabel: string | null
  scoreReason: string | null
}

async function generateMessage(prospect: ProspectForGeneration) {
  const configError = getCampaignAiConfigError(process.env.ANTHROPIC_API_KEY)
  if (configError) throw new Error(configError)

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 700,
    messages: [
      {
        role: 'user',
        content: buildCampaignAiPrompt(prospect),
      },
    ],
  })

  const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
  return parseCampaignAiText(text, prospect.name)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecte' }, { status: 401 })
  if (!isPro(user.plan)) return requireProResponse()

  const body = await req.json().catch(() => ({}))
  const requestedIds = Array.isArray(body.prospectIds)
    ? body.prospectIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
    : []
  const prospectIds: string[] = Array.from(new Set<string>(requestedIds)).slice(0, MAX_BATCH_SIZE)
  const overwrite = body.overwrite === true

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: params.id,
      userId: user.id,
    },
    include: {
      prospects: {
        where: {
          ...(prospectIds.length > 0 ? { id: { in: prospectIds } } : {}),
          ...(overwrite ? {} : { generatedBody: null }),
        },
        orderBy: { createdAt: 'asc' },
        take: MAX_BATCH_SIZE,
        select: {
          id: true,
          name: true,
          email: true,
          instagram: true,
          tiktok: true,
          twitch: true,
          website: true,
          channelUrl: true,
          score: true,
          scoreLabel: true,
          scoreReason: true,
        },
      },
    },
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
  }

  if (campaign.prospects.length === 0) {
    return NextResponse.json({
      generated: [],
      generatedCount: 0,
      skippedCount: requestedIds.length,
      message: overwrite
        ? 'Aucun prospect selectionne dans cette campagne.'
        : 'Tous les prospects selectionnes ont deja un message.',
    })
  }

  const generated = []

  for (const prospect of campaign.prospects) {
    try {
      const result = await generateMessage(prospect)
      const updated = await prisma.campaignProspect.update({
        where: { id: prospect.id },
        data: {
          generatedSubject: result.subject,
          generatedBody: result.body,
          status: 'Message pret',
          sendError: null,
        },
      })
      generated.push(updated)
    } catch (error) {
      console.error('POST /api/campaigns/[id]/generate error:', {
        campaignId: campaign.id,
        prospectId: prospect.id,
        message: error instanceof Error ? error.message : String(error),
      })
      const message = error instanceof Error ? error.message : 'Impossible de generer le message.'
      return NextResponse.json(
        { error: message },
        { status: message.includes('temporairement indisponible') ? 503 : 500 }
      )
    }
  }

  return NextResponse.json({
    generated,
    generatedCount: generated.length,
    limited: requestedIds.length > MAX_BATCH_SIZE,
  })
}
