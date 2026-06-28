import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SEND_MODE } from '@/lib/gmail'
import { isPro, requireProResponse } from '@/lib/plan'

export const dynamic = 'force-dynamic'

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
    if (!isPro(user.plan)) return requireProResponse()

    const account = await prisma.googleAccount.findUnique({
      where: { userId: user.id },
      select: {
        email: true,
        expiryDate: true,
        refreshToken: true,
        updatedAt: true,
      },
    })

    if (!account) {
      return NextResponse.json({
        connected: false,
        email: null,
        hasRefreshToken: false,
        expiryDate: null,
        updatedAt: null,
        sendMode: SEND_MODE,
      })
    }

    return NextResponse.json({
      connected: true,
      email: account.email || null,
      hasRefreshToken: Boolean(account.refreshToken),
      expiryDate: account.expiryDate?.toISOString() || null,
      updatedAt: account.updatedAt.toISOString(),
      sendMode: SEND_MODE,
    })
  } catch (error) {
    console.error('GET /api/gmail error:', error)

    const setupRequired =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2021' || error.code === 'P2022')

    return NextResponse.json({
      connected: false,
      email: null,
      hasRefreshToken: false,
      expiryDate: null,
      updatedAt: null,
      sendMode: SEND_MODE,
      unavailable: !setupRequired,
      setupRequired,
    })
  }
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  if (!isPro(user.plan)) return requireProResponse()

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

  return NextResponse.json({ ok: true })
}
