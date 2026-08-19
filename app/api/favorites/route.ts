import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function toNullableNumber(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function toNullableInt(value: unknown): number | null {
  const number = toNullableNumber(value)
  return number === null ? null : Math.round(number)
}

function toNullableDate(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.findUnique({ where: { email: session.user.email } })
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  let favorites
  try {
    favorites = await prisma.favorite.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2022') throw error
    favorites = await prisma.favorite.findMany({
      where: { userId: user.id }, orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true, channelId: true, name: true, subs: true, subsNum: true, niche: true, lang: true, score: true, scoreLabel: true, scoreReason: true, email: true, instagram: true, tiktok: true, twitch: true, website: true, channelUrl: true, aboutUrl: true, desc: true, avatar: true, color: true, thumbnail: true, totalViews: true, videoCount: true, channelCreatedAt: true, createdAt: true },
    })
    favorites = favorites.map(favorite => ({ ...favorite, facebook: null, twitter: null }))
  }

  return NextResponse.json({ favorites })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const channel = await req.json()
  const channelId = toNullableString(channel.channelId) || toNullableString(channel.id)

  if (!channelId) {
    return NextResponse.json({ error: 'Chaîne invalide' }, { status: 400 })
  }

  const createData = {
      userId: user.id,
      channelId,
      name: toNullableString(channel.name) || 'Chaîne inconnue',
      subs: toNullableString(channel.subs),
      subsNum: toNullableInt(channel.subsNum),
      niche: toNullableString(channel.niche),
      lang: toNullableString(channel.lang),
      score: toNullableInt(channel.score),
      scoreLabel: toNullableString(channel.scoreLabel),
      scoreReason: toNullableString(channel.scoreReason),
      email: toNullableString(channel.email),
      instagram: toNullableString(channel.instagram),
      tiktok: toNullableString(channel.tiktok),
      facebook: toNullableString(channel.facebook),
      twitter: toNullableString(channel.twitter),
      twitch: toNullableString(channel.twitch),
      website: toNullableString(channel.website),
      channelUrl: toNullableString(channel.channelUrl),
      aboutUrl: toNullableString(channel.aboutUrl),
      desc: toNullableString(channel.desc),
      avatar: toNullableString(channel.avatar),
      color: toNullableString(channel.color),
      thumbnail: toNullableString(channel.thumbnail),
      totalViews: toNullableNumber(channel.totalViews),
      videoCount: toNullableInt(channel.videoCount),
      channelCreatedAt: toNullableDate(channel.createdAt),
  }
  let favorite
  try {
    favorite = await prisma.favorite.upsert({
    where: {
      userId_channelId: {
        userId: user.id,
        channelId,
      },
    },
    update: {},
      create: createData,
    })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2022') throw error
    const { facebook: _facebook, twitter: _twitter, ...legacyCreateData } = createData
    favorite = await prisma.favorite.upsert({ where: { userId_channelId: { userId: user.id, channelId } }, update: {}, create: legacyCreateData })
  }

  return NextResponse.json({ favorite })
}
