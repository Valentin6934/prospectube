import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPro, requireProResponse } from '@/lib/plan'

export const dynamic = 'force-dynamic'

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
  if (!isPro(user.plan)) return requireProResponse()

  const body = await req.json().catch(() => ({}))
  const subject = cleanText(body.generatedSubject)
  const message = cleanText(body.generatedBody)

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

  const updated = await prisma.campaignProspect.update({
    where: { id: prospect.id },
    data: {
      generatedSubject: subject,
      generatedBody: message,
      status: 'Message pret',
      sendError: null,
    },
  })

  return NextResponse.json({ prospect: updated })
}
