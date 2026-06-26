import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function toNullableInt(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number) : null
}

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.findUnique({ where: { email: session.user.email } })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

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
    score: toNullableInt(channel.score),
    scoreLabel: toNullableString(channel.scoreLabel),
    scoreReason: toNullableString(channel.scoreReason),
  }

  const result = await prisma.campaignProspect.createMany({
    data: [prospectData],
    skipDuplicates: true,
  })

  const prospect = await prisma.campaignProspect.findUnique({
    where: {
      campaignId_channelId: {
        campaignId: campaign.id,
        channelId,
      },
    },
  })

  return NextResponse.json({ prospect, added: result.count === 1 })
}
