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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const favorite = await prisma.favorite.findFirst({
    where: {
      id: params.id,
      userId: user.id,
    },
  })

  if (!favorite) {
    return NextResponse.json({ error: 'Favori introuvable' }, { status: 404 })
  }

  await prisma.favorite.delete({ where: { id: favorite.id } })

  return NextResponse.json({ ok: true })
}
