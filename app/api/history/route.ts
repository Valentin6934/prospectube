import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function getResultCount(results: string): number {
  try {
    const parsed = JSON.parse(results)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.findUnique({ where: { email: session.user.email } })
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const searches = await prisma.search.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({
    searches: searches.map(search => ({
      id: search.id,
      niche: search.niche,
      language: search.language,
      subsMin: search.subsMin,
      subsMax: search.subsMax,
      resultCount: getResultCount(search.results),
      createdAt: search.createdAt,
    })),
  })
}
