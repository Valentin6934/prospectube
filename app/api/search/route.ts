import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLAN_LIMITS } from '@/lib/data'
import { discoverYouTubeCatalog, YouTubeCallMetrics } from '@/lib/youtube'
import { filterYouTubeCatalog, YouTubeDiscoveryCatalog } from '@/lib/youtubeCatalog'
import { getPlanName, isPro } from '@/lib/plan'
import { selectDiverseProspectPreview } from '@/lib/freePreview'
import { validateSearchTarget } from '@/lib/searchTargeting'
import { buildYouTubeErrorResponse, getSafeYouTubeLog } from '@/lib/youtubeQuota'
import {
  buildSearchCacheKey,
  getCatalogAgeHours,
  getSearchLimit,
  getSearchQuotaMessage,
  SEARCH_NEGATIVE_CACHE_TTL_HOURS,
  SEARCH_CACHE_TTL_HOURS,
  SEARCH_CACHE_VERSION,
  SEARCH_LOCK_TTL_MS,
  SearchPlan,
  shouldEnrichSearchCatalog,
} from '@/lib/searchPolicy'
import {
  acquireSearchLock,
  completeSearchQuota,
  getReleasedSearchQuotaSnapshot,
  getSearchQuotaSnapshot,
  releaseSearchLock,
  releaseSearchQuota,
  reserveSearchQuota,
} from '@/lib/searchQuota'

export const dynamic = 'force-dynamic'

const SUBS_VALUES = [1000, 10000, 50000, 100000, 500000, 1000000, 5000000]
const CACHE_TTL_MS = SEARCH_CACHE_TTL_HOURS * 60 * 60 * 1000

function hashLogValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

function parseDiscoveryCatalog(results: unknown): YouTubeDiscoveryCatalog | null {
  const value = typeof results === 'string' ? (() => {
    try { return JSON.parse(results) } catch { return null }
  })() : results
  if (!value || typeof value !== 'object' || !Array.isArray((value as any).channels)) return null
  return value as YouTubeDiscoveryCatalog
}

function buildRangeKey(subsMin: number, subsMax: number): string {
  return `${subsMin}:${subsMax}`
}

function parseSearchBody(body: any) {
  const target = validateSearchTarget(body)
  const minIndex = Number.parseInt(String(body?.subsMin ?? ''), 10)
  const maxIndex = Number.parseInt(String(body?.subsMax ?? ''), 10)
  const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : ''

  if (!target || !Number.isInteger(minIndex) || !Number.isInteger(maxIndex) ||
      minIndex < 0 || maxIndex >= SUBS_VALUES.length || minIndex > maxIndex ||
      !/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) {
    return null
  }

  return {
    niche: target.niche,
    lang: target.language,
    target,
    minVal: SUBS_VALUES[minIndex],
    maxVal: SUBS_VALUES[maxIndex],
    requestId,
    filters: {
      emailOnly: body?.emailOnly === true,
      activeOnly: body?.activeOnly === true,
      minMedianViews: Math.min(10000000, Math.max(0, Number(body?.minMedianViews) || 0)),
      minContentRelevance: Math.min(100, Math.max(0, Number(body?.minContentRelevance) || 10)),
    },
  }
}

async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  return prisma.user.findUnique({ where: { email: session.user.email } })
}

async function saveSearchHistory(input: {
  userId: string
  niche: string
  lang: string
  subsMin: number
  subsMax: number
  results: any[]
}) {
  try {
    await prisma.search.create({
      data: {
        userId: input.userId,
        niche: input.niche,
        language: input.lang,
        subsMin: String(input.subsMin),
        subsMax: String(input.subsMax),
        results: JSON.stringify(input.results),
      },
    })
  } catch (error) {
    console.error('Search history persistence failed:', {
      userIdHash: hashLogValue(input.userId),
      error: error instanceof Error ? error.message : 'Unknown persistence error',
    })
  }
}

function quotaResponse(plan: SearchPlan, remaining: number) {
  const free = plan === 'Gratuit'
  return NextResponse.json({
    error: free ? 'FREE_SEARCH_USED' : 'PRO_DAILY_SEARCH_LIMIT_REACHED',
    message: getSearchQuotaMessage(plan, remaining),
    upgrade: free,
    quota: { limit: getSearchLimit(plan), remaining, period: free ? 'lifetime' : 'utc_day' },
  }, { status: free ? 403 : 429 })
}

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non connecte' }, { status: 401 })
  const plan = getPlanName(user.plan)
  const quota = await getSearchQuotaSnapshot(prisma, user.id, plan)
  return NextResponse.json({ plan, quota, message: getSearchQuotaMessage(plan, quota.remaining) })
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non connecte' }, { status: 401 })

  const parsed = parseSearchBody(await req.json().catch(() => null))
  if (!parsed) return NextResponse.json({ error: 'SEARCH_INVALID', message: 'Les criteres de recherche sont invalides.' }, { status: 400 })

  const plan = getPlanName(user.plan)
  const proUser = isPro(user.plan)
  const limits = PLAN_LIMITS[plan]
  const cacheKey = buildSearchCacheKey({
    niche: parsed.niche,
    lang: parsed.lang,
    subNiches: parsed.target.subNiches,
    customKeyword: parsed.target.customKeyword,
  })
  const cacheKeyHash = hashLogValue(cacheKey)
  const userIdHash = hashLogValue(user.id)
  const metrics: YouTubeCallMetrics = {
    searchList: 0,
    channelsList: 0,
    aboutPages: 0,
    searchQueriesUsed: 0,
    rawCandidates: 0,
    uniqueCandidates: 0,
    hiddenSubscribers: 0,
    belowMinimum: 0,
    aboveMaximum: 0,
    acceptedResults: 0,
    videosList: 0,
  }
  let reserved = false
  let lockAcquired = false
  let responseStatus = 500
  let errorCode: string | undefined

  const logSearch = (extra: Record<string, unknown>) => console.info('YouTube catalog event:', {
    catalogHit: false,
    catalogAge: null,
    catalogCandidateCount: 0,
    filteredResultCount: metrics.acceptedResults,
    enrichmentTriggered: false,
    queryVariantCount: metrics.searchQueriesUsed,
    searchListCalls: metrics.searchList,
    channelsListCalls: metrics.channelsList,
    videosListCalls: metrics.videosList,
    searchQueriesUsed: metrics.searchQueriesUsed,
    rawVideoResults: metrics.rawCandidates,
    uniqueChannelIds: metrics.uniqueCandidates,
    enrichedChannels: metrics.uniqueCandidates,
    rejectedByMissingSubscribers: metrics.hiddenSubscribers,
    rejectedBelowSubscribers: metrics.belowMinimum,
    rejectedAboveSubscribers: metrics.aboveMaximum,
    rejectedByLanguage: 0,
    rejectedByTopic: 0,
    rejectedByActivity: 0,
    rejectedByAdvancedFilters: 0,
    acceptedResults: metrics.acceptedResults,
    displayedResults: 0,
    cacheVersion: SEARCH_CACHE_VERSION,
    ...extra,
  })

  try {
    lockAcquired = await acquireSearchLock({
      prisma,
      userId: user.id,
      requestId: parsed.requestId,
      cacheKey,
      expiresAt: new Date(Date.now() + SEARCH_LOCK_TTL_MS),
    })
    if (!lockAcquired) {
      responseStatus = 409
      errorCode = 'SEARCH_ALREADY_RUNNING'
      return NextResponse.json({
        error: errorCode,
        message: 'Une recherche est deja en cours. Patientez quelques instants.',
        retryable: true,
      }, { status: responseStatus })
    }

    const reservation = await reserveSearchQuota({
      prisma,
      userId: user.id,
      requestId: parsed.requestId,
      cacheKey,
      plan,
    })
    if (!reservation.reserved) {
      responseStatus = reservation.duplicate ? 409 : plan === 'Gratuit' ? 403 : 429
      errorCode = reservation.duplicate ? 'SEARCH_REQUEST_ALREADY_PROCESSED' : undefined
      if (reservation.duplicate) {
        return NextResponse.json({ error: errorCode, message: 'Cette requete a deja ete traitee.' }, { status: responseStatus })
      }
      return quotaResponse(plan, reservation.snapshot.remaining)
    }
    reserved = true

    let catalog: YouTubeDiscoveryCatalog | null = null
    let catalogHit = false
    let catalogAge = Number.POSITIVE_INFINITY
    try {
      const cachedSearch = await prisma.searchCache.findFirst({
        where: { cacheKey, algorithmVersion: SEARCH_CACHE_VERSION, expiresAt: { gt: new Date() } },
      })
      catalog = cachedSearch ? parseDiscoveryCatalog(cachedSearch.results) : null
      catalogHit = Boolean(catalog)
      catalogAge = catalog ? getCatalogAgeHours(catalog.collectedAt) : Number.POSITIVE_INFINITY
    } catch (error) {
      console.error('Search cache read failed:', {
        cacheKeyHash,
        error: error instanceof Error ? error.message : 'Unknown cache error',
      })
    }

    let catalogResults = catalog ? filterYouTubeCatalog(catalog, parsed.minVal, parsed.maxVal, limits.results, parsed.filters, parsed.target) : []
    const enrichmentTriggered = Boolean(catalog && shouldEnrichSearchCatalog({
      candidateCount: catalog.channels.length,
      filteredResultCount: catalogResults.length,
      collectedAt: catalog.collectedAt,
    }))
    const negativeCatalogHit = Boolean(catalog && catalog.channels.length === 0)

    if (catalog && !enrichmentTriggered) {
      if (catalogResults.length === 0) {
        await releaseSearchQuota(prisma, parsed.requestId)
        reserved = false
        const emptyQuota = getReleasedSearchQuotaSnapshot(reservation.snapshot)
        responseStatus = 200
        logSearch({ catalogHit: true, catalogAge, catalogCandidateCount: catalog.channels.length, filteredResultCount: 0 })
        return NextResponse.json({
          results: [], source: 'catalog', cached: true, emptyResult: true,
          searchesRemaining: emptyQuota.remaining, quota: emptyQuota, plan,
          canGenerateEmail: limits.emailAI,
        })
      }
      const visibleResults = proUser
        ? catalogResults
        : selectDiverseProspectPreview(catalogResults, limits.results)
      metrics.acceptedResults = visibleResults.length
      await completeSearchQuota(prisma, parsed.requestId, true)
      reserved = false
      await saveSearchHistory({
        userId: user.id,
        niche: parsed.niche,
        lang: parsed.lang,
        subsMin: parsed.minVal,
        subsMax: parsed.maxVal,
        results: visibleResults,
      })
      responseStatus = 200
      logSearch({ catalogHit: true, catalogAge, catalogCandidateCount: catalog.channels.length, filteredResultCount: visibleResults.length })
      return NextResponse.json({
        results: visibleResults,
        resultMeta: { analyzed: catalog.channels.length, matched: catalogResults.length, displayed: visibleResults.length, limit: limits.results, nearby: visibleResults.some(item => item.matchMode === 'nearby') },
        source: 'catalog',
        cached: true,
        searchesRemaining: reservation.snapshot.remaining,
        quota: reservation.snapshot,
        plan,
        canGenerateEmail: limits.emailAI,
      })
    }

    let discoveredCatalog: YouTubeDiscoveryCatalog
    try {
      discoveredCatalog = await discoverYouTubeCatalog(
        parsed.niche, parsed.lang, parsed.minVal, parsed.maxVal, metrics,
        enrichmentTriggered ? catalog : null,
        parsed.target
      )
    } catch (error) {
      const safeError = getSafeYouTubeLog(error)
      console.error('YouTube search failed:', { userIdHash, cacheKeyHash, ...safeError })
      const response = buildYouTubeErrorResponse(error)
      responseStatus = response.status
      errorCode = response.body.error
      return NextResponse.json(response.body, { status: response.status })
    }

    catalog = discoveredCatalog
    catalogResults = filterYouTubeCatalog(catalog, parsed.minVal, parsed.maxVal, limits.results, parsed.filters, parsed.target)
    const visibleResults = proUser ? catalogResults : selectDiverseProspectPreview(catalogResults, limits.results)

    if (visibleResults.length === 0) {
      catalog.negativeRanges = {
        ...(catalog.negativeRanges || {}),
        [buildRangeKey(parsed.minVal, parsed.maxVal)]: new Date(
          Date.now() + SEARCH_NEGATIVE_CACHE_TTL_HOURS * 3_600_000
        ).toISOString(),
      }
      const catalogTtlHours = catalog.channels.length === 0
        ? SEARCH_NEGATIVE_CACHE_TTL_HOURS
        : SEARCH_CACHE_TTL_HOURS
      try {
        await prisma.searchCache.upsert({
          where: { cacheKey },
          update: { results: catalog, algorithmVersion: SEARCH_CACHE_VERSION, expiresAt: new Date(Date.now() + catalogTtlHours * 3_600_000) },
          create: { cacheKey, niche: parsed.niche, lang: parsed.lang, subsMin: 0, subsMax: 0, results: catalog, algorithmVersion: SEARCH_CACHE_VERSION, expiresAt: new Date(Date.now() + catalogTtlHours * 3_600_000) },
        })
      } catch (error) {
        console.error('Search catalog write failed:', { cacheKeyHash, error: error instanceof Error ? error.message : 'Unknown cache error' })
      }
      await releaseSearchQuota(prisma, parsed.requestId)
      reserved = false
      const emptyQuota = getReleasedSearchQuotaSnapshot(reservation.snapshot)
      responseStatus = 200
      logSearch({
        catalogHit, catalogAge: Number.isFinite(catalogAge) ? catalogAge : null, catalogCandidateCount: catalog.channels.length,
        filteredResultCount: 0, displayedResults: 0, enrichmentTriggered,
      })
      return NextResponse.json({
        results: [],
        source: catalogHit || negativeCatalogHit ? 'catalog' : 'youtube',
        cached: false,
        emptyResult: true,
        searchesRemaining: emptyQuota.remaining,
        quota: emptyQuota,
        plan,
        canGenerateEmail: limits.emailAI,
      })
    }

    try {
      await prisma.searchCache.upsert({
        where: { cacheKey },
        update: {
          niche: parsed.niche,
          lang: parsed.lang,
          subsMin: 0,
          subsMax: 0,
          algorithmVersion: SEARCH_CACHE_VERSION,
          results: catalog,
          expiresAt: new Date(Date.now() + CACHE_TTL_MS),
        },
        create: {
          cacheKey,
          niche: parsed.niche,
          lang: parsed.lang,
          subsMin: 0,
          subsMax: 0,
          algorithmVersion: SEARCH_CACHE_VERSION,
          results: catalog,
          expiresAt: new Date(Date.now() + CACHE_TTL_MS),
        },
      })
    } catch (error) {
      console.error('Search cache write failed:', {
        cacheKeyHash,
        error: error instanceof Error ? error.message : 'Unknown cache error',
      })
    }

    await completeSearchQuota(prisma, parsed.requestId, false)
    reserved = false
    await saveSearchHistory({
      userId: user.id,
      niche: parsed.niche,
      lang: parsed.lang,
      subsMin: parsed.minVal,
      subsMax: parsed.maxVal,
        results: visibleResults,
    })
    responseStatus = 200
    logSearch({ catalogHit, catalogAge: Number.isFinite(catalogAge) ? catalogAge : null, catalogCandidateCount: catalog.channels.length, filteredResultCount: catalogResults.length, acceptedResults: catalogResults.length, displayedResults: visibleResults.length, enrichmentTriggered })
    return NextResponse.json({
      results: visibleResults,
      resultMeta: { analyzed: catalog.channels.length, matched: catalogResults.length, displayed: visibleResults.length, limit: limits.results, nearby: visibleResults.some(item => item.matchMode === 'nearby') },
      source: 'youtube',
      cached: false,
      searchesRemaining: reservation.snapshot.remaining,
      quota: reservation.snapshot,
      plan,
      canGenerateEmail: limits.emailAI,
    })
  } catch (error) {
    errorCode = 'SEARCH_INTERNAL_ERROR'
    responseStatus = 500
    console.error('POST /api/search error:', {
      userIdHash,
      cacheKeyHash,
      error: error instanceof Error ? error.message : 'Unknown search error',
    })
    return NextResponse.json({ error: errorCode, message: 'La recherche est temporairement indisponible.' }, { status: responseStatus })
  } finally {
    if (reserved) await releaseSearchQuota(prisma, parsed.requestId).catch(error => console.error('Search quota release failed:', { userIdHash, error: error instanceof Error ? error.message : 'Unknown error' }))
    if (lockAcquired) await releaseSearchLock(prisma, parsed.requestId).catch(error => console.error('Search lock release failed:', { userIdHash, error: error instanceof Error ? error.message : 'Unknown error' }))
    if (responseStatus !== 200) logSearch({})
  }
}
