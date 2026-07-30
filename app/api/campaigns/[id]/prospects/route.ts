import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPro, requireProResponse } from '@/lib/plan'

export const dynamic = 'force-dynamic'

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function toNullableInt(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number) : null
}

function isMissingColumnError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022'
}

const prospectSelect = {
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

const prospectSelectWithMedia = {
  ...prospectSelect,
  avatar: true,
  thumbnail: true,
}

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.findUnique({ where: { email: session.user.email } })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

  const channel = await req.json().catch(() => ({}))
  const channelId = toNullableString(channel.channelId) || toNullableString(channel.id)

  if (!channelId) {
    return NextResponse.json({ error: 'Chaîne invalide' }, { status: 400 })
  }

  const prospectData = {
    campaignId: campaign.id,
    channelId,
    name: toNullableString(channel.name) || 'Chaîne inconnue',
    email: toNullableString(channel.email),
    instagram: toNullableString(channel.instagram),
    tiktok: toNullableString(channel.tiktok),
    twitch: toNullableString(channel.twitch),
    website: toNullableString(channel.website),
    channelUrl: toNullableString(channel.channelUrl),
    avatar: toNullableString(channel.avatar),
    thumbnail: toNullableString(channel.thumbnail),
    score: toNullableInt(channel.score),
    scoreLabel: toNullableString(channel.scoreLabel),
    scoreReason: toNullableString(channel.scoreReason),
  }

  let result
  try {
    result = await prisma.campaignProspect.createMany({
      data: [prospectData],
      skipDuplicates: true,
    })
  } catch (error) {
    if (!isMissingColumnError(error)) {
      console.error('POST /api/campaigns/[id]/prospects error:', {
        campaignId: campaign.id,
        userId: user.id,
        message: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: "Impossible d'ajouter ce prospect a la campagne." }, { status: 500 })
    }

    console.error('POST /api/campaigns/[id]/prospects missing media columns:', {
      campaignId: campaign.id,
      userId: user.id,
    })
    const { avatar: _avatar, thumbnail: _thumbnail, ...fallbackData } = prospectData
    result = await prisma.campaignProspect.createMany({
      data: [fallbackData],
      skipDuplicates: true,
    })
  }

  let prospect
  try {
    prospect = await prisma.campaignProspect.findUnique({
      where: {
        campaignId_channelId: {
          campaignId: campaign.id,
          channelId,
        },
      },
      select: prospectSelectWithMedia,
    })
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
    console.error('POST /api/campaigns/[id]/prospects find missing media columns:', {
      campaignId: campaign.id,
      userId: user.id,
    })
    prospect = await prisma.campaignProspect.findUnique({
      where: {
        campaignId_channelId: {
          campaignId: campaign.id,
          channelId,
        },
      },
      select: prospectSelect,
    })
  }

  return NextResponse.json({
    prospect: prospect ? { avatar: null, thumbnail: null, ...prospect } : null,
    added: result.count === 1,
  })
}
