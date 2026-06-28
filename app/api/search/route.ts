import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLAN_LIMITS, filterChannels } from '@/lib/data'
import { searchYouTubeChannels } from '@/lib/youtube'
import { getPlanName, isPro } from '@/lib/plan'

export const dynamic = 'force-dynamic'

const SUBS_VALUES = [1000, 10000, 50000, 100000, 500000, 1000000, 5000000]
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function normalizeCachePart(value: string): string {
  return String(value || 'all')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'all'
}

function buildCacheKey(niche: string, lang: string, subsMin: number, subsMax: number): string {
  return `${normalizeCachePart(niche)}-${normalizeCachePart(lang)}-${subsMin}-${subsMax}`
}

function parseCachedResults(results: unknown): any[] {
  if (Array.isArray(results)) return results

  if (typeof results === 'string') {
    try {
      const parsed = JSON.parse(results)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
}

async function saveSearchHistory(
  userId: string,
  niche: string,
  lang: string,
  subsMin: number,
  subsMax: number,
  results: any[]
) {
  try {
    await prisma.search.create({
      data: {
        userId,
        niche,
        language: lang || 'Tous',
        subsMin: String(subsMin),
        subsMax: String(subsMax),
        results: JSON.stringify(results),
      },
    })
  } catch (err) {
    console.error('Erreur sauvegarde historique:', err)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!user) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const proUser = isPro(user.plan)
  const plan = getPlanName(user.plan)
  const limits = PLAN_LIMITS[plan]

  if (!proUser && user.searchesRemaining <= 0)
    return NextResponse.json({ error: 'Quota épuisé', upgrade: true }, { status: 403 })

  const body = await req.json()
  const niche = body.niche || ''
  const lang = body.lang || ''
  const subsMin = body.subsMin || '1'
  const subsMax = body.subsMax || '4'

  const minVal = SUBS_VALUES[parseInt(subsMin)] || 0
  const maxVal = SUBS_VALUES[parseInt(subsMax)] || 5000000
  const cacheKey = buildCacheKey(niche, lang, minVal, maxVal)

  let results: any[] = []
  let source = 'youtube'

  try {
    const cachedSearch = await prisma.searchCache.findFirst({
      where: {
        cacheKey,
        expiresAt: { gt: new Date() },
      },
    })

    const cachedResults = cachedSearch ? parseCachedResults(cachedSearch.results) : []

    if (cachedSearch && cachedResults.length > 0) {
      await saveSearchHistory(user.id, niche, lang, minVal, maxVal, cachedResults)

      const nextFreeSearchesRemaining = Math.max(0, user.searchesRemaining - 1)
      const searchesRemaining = proUser ? null : nextFreeSearchesRemaining
      if (!proUser) {
        await prisma.user.update({
          where: { id: user.id },
          data: { searchesRemaining: nextFreeSearchesRemaining },
        })
      }

      return NextResponse.json({
        results: cachedResults,
        source,
        cached: true,
        searchesRemaining,
        plan: user.plan,
        canGenerateEmail: limits.emailAI,
      })
    }
  } catch (err) {
    console.error('Erreur lecture cache recherche:', err)
  }

try {
  results = await searchYouTubeChannels(niche, lang, minVal, maxVal, limits.results)
} catch (err: any) {
  console.error('Erreur YouTube:', err)
  return NextResponse.json(
    { error: err?.message || 'Erreur inconnue YouTube', source: 'youtube_error' },
    { status: 500 }
  )
}

  await saveSearchHistory(user.id, niche, lang, minVal, maxVal, results)

  try {
    await prisma.searchCache.upsert({
      where: { cacheKey },
      update: {
        niche,
        lang,
        subsMin: minVal,
        subsMax: maxVal,
        results,
        expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      },
      create: {
        cacheKey,
        niche,
        lang,
        subsMin: minVal,
        subsMax: maxVal,
        results,
        expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      },
    })
  } catch (err) {
    console.error('Erreur sauvegarde cache recherche:', err)
  }

  const nextFreeSearchesRemaining = Math.max(0, user.searchesRemaining - 1)
  const searchesRemaining = proUser ? null : nextFreeSearchesRemaining
  if (!proUser) {
    await prisma.user.update({
      where: { id: user.id },
      data: { searchesRemaining: nextFreeSearchesRemaining },
    })
  }

  return NextResponse.json({
    results,
    source,
    cached: false,
    searchesRemaining,
    plan: user.plan,
    canGenerateEmail: limits.emailAI,
  })
}
