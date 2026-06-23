import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLAN_LIMITS, filterChannels } from '@/lib/data'
import { searchYouTubeChannels } from '@/lib/youtube'

export const dynamic = 'force-dynamic'

const SUBS_VALUES = [1000, 10000, 50000, 100000, 500000, 1000000, 5000000]

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!user) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const plan = user.plan as keyof typeof PLAN_LIMITS
  const limits = PLAN_LIMITS[plan]

  if (user.searchesRemaining <= 0)
    return NextResponse.json({ error: 'Quota épuisé', upgrade: true }, { status: 403 })

  const body = await req.json()
  const niche = body.niche || ''
  const lang = body.lang || ''
  const subsMin = body.subsMin || '1'
  const subsMax = body.subsMax || '4'

  const minVal = SUBS_VALUES[parseInt(subsMin)] || 0
  const maxVal = SUBS_VALUES[parseInt(subsMax)] || 5000000

  let results: any[] = []
  let source = 'youtube'

try {
  results = await searchYouTubeChannels(niche, lang, minVal, maxVal, limits.results)
} catch (err: any) {
  console.error('Erreur YouTube:', err)
  return NextResponse.json(
    { error: err?.message || 'Erreur inconnue YouTube', source: 'youtube_error' },
    { status: 500 }
  )
}

  await prisma.search.create({
    data: {
      userId: user.id,
      niche,
      language: lang || 'Tous',
      subsMin: String(minVal),
      subsMax: String(maxVal),
      results: JSON.stringify(results),
    },
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { searchesRemaining: user.searchesRemaining - 1 },
  })

  return NextResponse.json({
    results,
    source,
    searchesRemaining: user.searchesRemaining - 1,
    plan: user.plan,
    canGenerateEmail: limits.emailAI,
  })
}