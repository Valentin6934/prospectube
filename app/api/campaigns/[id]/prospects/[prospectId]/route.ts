import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPro } from '@/lib/plan'
import { normalizeCampaignMessage } from '@/lib/campaignWorkflow'
import { canUseFreeCampaign, freeCampaignLimitResponse } from '@/lib/campaignAccess'

export const dynamic = 'force-dynamic'

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
  createdAt: true,
}

const prospectSelectWithMedia = {
  ...prospectSelect,
  facebook: true,
  twitter: true,
  avatar: true,
  thumbnail: true,
}

function isMissingColumnError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022'
}

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, plan: true },
  })
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; prospectId: string } }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecte' }, { status: 401 })

  if (!isPro(user.plan) && !(await canUseFreeCampaign(prisma, user.id, params.id))) {
    return freeCampaignLimitResponse()
  }

  const body = await req.json().catch(() => ({}))
  const normalized = normalizeCampaignMessage({
    subject: body.subject ?? body.generatedSubject,
    body: body.body ?? body.generatedBody,
  })
  const subject = cleanText(normalized.subject)
  const message = cleanText(normalized.body)

  if (!subject) {
    return NextResponse.json({ error: 'Sujet requis.' }, { status: 400 })
  }

  if (!message) {
    return NextResponse.json({ error: 'Message requis.' }, { status: 400 })
  }

  const prospect = await prisma.campaignProspect.findFirst({
    where: {
      id: params.prospectId,
      campaignId: params.id,
      campaign: { userId: user.id },
    },
    select: { id: true },
  })

  if (!prospect) {
    return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 })
  }

  const updateData = {
    generatedSubject: subject,
    generatedBody: message,
    status: 'Message pret',
  }

  try {
    const updated = await prisma.campaignProspect.update({
      where: { id: prospect.id },
      data: updateData,
      select: prospectSelectWithMedia,
    })
    return NextResponse.json({ prospect: updated })
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
    console.error('PATCH /api/campaigns/[id]/prospects/[prospectId] missing media columns:', {
      campaignId: params.id,
      prospectId: params.prospectId,
      userId: user.id,
    })
    const updated = await prisma.campaignProspect.update({
      where: { id: prospect.id },
      data: updateData,
      select: prospectSelect,
    })
    return NextResponse.json({ prospect: { ...updated, avatar: null, thumbnail: null, facebook: null, twitter: null } })
  }
}
