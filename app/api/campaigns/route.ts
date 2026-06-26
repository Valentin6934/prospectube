import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.findUnique({ where: { email: session.user.email } })
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const campaignRecords = await prisma.campaign.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { prospects: true },
      },
      prospects: {
        select: { channelId: true },
      },
    },
  })

  const campaigns = campaignRecords.map(({ prospects, ...campaign }) => ({
    ...campaign,
    prospectChannelIds: prospects.map(prospect => prospect.channelId),
  }))

  return NextResponse.json({ campaigns })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!name) {
    return NextResponse.json({ error: 'Nom de campagne requis' }, { status: 400 })
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId: user.id,
      name,
    },
    include: {
      _count: {
        select: { prospects: true },
      },
    },
  })

  return NextResponse.json({ campaign })
}
