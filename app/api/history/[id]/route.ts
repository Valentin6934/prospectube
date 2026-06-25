import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function parseResults(results: string): any[] {
  try {
    const parsed = JSON.parse(results)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.findUnique({ where: { email: session.user.email } })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const search = await prisma.search.findFirst({
    where: {
      id: params.id,
      userId: user.id,
    },
  })

  if (!search) {
    return NextResponse.json({ error: 'Recherche introuvable' }, { status: 404 })
  }

  const results = parseResults(search.results)

  return NextResponse.json({
    search: {
      id: search.id,
      niche: search.niche,
      language: search.language,
      subsMin: search.subsMin,
      subsMax: search.subsMax,
      results,
      resultCount: results.length,
      createdAt: search.createdAt,
    },
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const search = await prisma.search.findFirst({
    where: {
      id: params.id,
      userId: user.id,
    },
  })

  if (!search) {
    return NextResponse.json({ error: 'Recherche introuvable' }, { status: 404 })
  }

  await prisma.search.delete({ where: { id: search.id } })

  return NextResponse.json({ ok: true })
}
