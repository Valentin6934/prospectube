import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPro, requireProResponse } from '@/lib/plan'

export const dynamic = 'force-dynamic'

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.findUnique({ where: { email: session.user.email } })
}

const campaignProspectSelect = {
  id: true,
  campaignId: true,
  channelId: true,
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
  generatedSubject: true,
  generatedBody: true,
  status: true,
  sendStatus: true,
  sentAt: true,
  sendError: true,
  gmailMessageId: true,
  createdAt: true,
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  if (!isPro(user.plan)) return requireProResponse()

  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
      include: {
        prospects: {
          orderBy: { createdAt: 'desc' },
          select: campaignProspectSelect,
        },
        _count: {
          select: { prospects: true },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    }

    return NextResponse.json({
      campaign: {
        ...campaign,
        prospects: campaign.prospects.map(prospect => ({
          ...prospect,
          avatar: null,
          thumbnail: null,
        })),
      },
    })
  } catch (error) {
    console.error('GET /api/campaigns/[id] error:', {
      campaignId: params.id,
      userId: user.id,
      prismaCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Impossible de charger cette campagne.' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  if (!isPro(user.plan)) return requireProResponse()

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: params.id,
      userId: user.id,
    },
    select: { id: true },
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
  }

  await prisma.campaign.delete({ where: { id: campaign.id } })

  return NextResponse.json({ ok: true })
}
