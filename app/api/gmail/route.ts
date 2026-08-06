import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SEND_MODE } from '@/lib/gmail'
import { buildDisconnectedGmailStatus, buildGmailStatus } from '@/lib/gmailStatus'
import { canUseGmailIntegration } from '@/lib/campaignAccess'

export const dynamic = 'force-dynamic'
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' }

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, plan: true },
  })
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

    const account = await prisma.googleAccount.findUnique({
      where: { userId: user.id },
      select: {
        email: true,
        expiryDate: true,
        refreshToken: true,
        scope: true,
        updatedAt: true,
      },
    })
    const accessAllowed = await canUseGmailIntegration(prisma, user)

    if (!account) {
      return NextResponse.json({
        ...buildDisconnectedGmailStatus(SEND_MODE),
        accessAllowed,
        upgradeRequired: !accessAllowed,
      }, { headers: NO_STORE_HEADERS })
    }

    return NextResponse.json(buildGmailStatus(account, SEND_MODE, { accessAllowed }), { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('GET /api/gmail error:', error)

    const setupRequired =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2021' || error.code === 'P2022')

    return NextResponse.json(
      buildGmailStatus(null, SEND_MODE, {
        unavailable: !setupRequired,
        setupRequired,
      }),
      { headers: NO_STORE_HEADERS }
    )
  }
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const account = await prisma.googleAccount.findUnique({
    where: { userId: user.id },
    select: { accessToken: true, refreshToken: true },
  })

  if (account) {
    const token = account.refreshToken || account.accessToken
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      cache: 'no-store',
    }).catch(() => null)

    await prisma.googleAccount.delete({ where: { userId: user.id } })
  }

  return NextResponse.json({ ok: true, gmail: buildDisconnectedGmailStatus(SEND_MODE) }, { headers: NO_STORE_HEADERS })
}
