import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SEND_MODE } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true },
  })
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const account = await prisma.googleAccount.findUnique({
    where: { userId: user.id },
    select: {
      expiryDate: true,
      refreshToken: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({
    connected: Boolean(account),
    email: account ? user.email : null,
    hasRefreshToken: Boolean(account?.refreshToken),
    expiryDate: account?.expiryDate?.toISOString() || null,
    updatedAt: account?.updatedAt.toISOString() || null,
    sendMode: SEND_MODE,
  })
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

  return NextResponse.json({ ok: true })
}
