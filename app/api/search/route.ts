import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLAN_LIMITS } from '@/lib/data'
import { discoverYouTubeCatalog, YouTubeCallMetrics } from '@/lib/youtube'
import { filterYouTubeCatalog, YouTubeDiscoveryCatalog } from '@/lib/youtubeCatalog'
import { getPlanName } from '@/lib/plan'
import { validateSearchTarget } from '@/lib/searchTargeting'
import { buildExposureTargetKey, countGlobalChannelExposure, diversifyProspects, extractChannelIdsFromSearchResults } from '@/lib/resultDiversification'
import { calculateCatalogCoverage, getUserCoverage } from '@/lib/catalogCoverage'
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

function buildResultMeta(returned: any[]) {
  const strict = returned.filter(item => item.matchMode !== 'nearby')
  const nearby = returned.filter(item => item.matchMode === 'nearby')
  return {
    matched: returned.length,
    strict: strict.length,
    nearby: nearby.length,
    newCount: returned.filter(item => !item.previouslySeen).length,
    seenCount: returned.filter(item => item.previouslySeen).length,
  }
}

function getCatalogLogDetails(catalog: YouTubeDiscoveryCatalog) {
  const variants = Object.values(catalog.variantPerformance || {})
  return {
    catalogAgeHours: getCatalogAgeHours(catalog.collectedAt),
    catalogTotalChannels: catalog.channels.length,
    catalogStrictMatches: catalog.coverage?.totalStrictMatchesKnown || 0,
    catalogNearbyMatches: catalog.coverage?.totalNearbyMatchesKnown || 0,
    catalogCoverageRate: catalog.coverage?.coverageRate || 0,
    catalogNewlyDiscovered: catalog.newlyDiscoveredThisRun || 0,
    catalogAlreadyKnown: catalog.alreadyKnownThisRun || 0,
    queryVariantIds: variants.map(item => item.variantId),
    queryVariantYields: variants.map(item => item.yield),
    selectedVariantLevels: variants.map(item => item.level),
    duplicateVideoResults: catalog.duplicateVideoResults || 0,
  }
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
    rejectedLanguage: 0,
    rejectedNiche: 0,
  }
  let reserved = false
  let lockAcquired = false
  let responseStatus = 500
  let errorCode: string | undefined

  const selectVisibleResults = async (channels: any[], sourceCatalog: YouTubeDiscoveryCatalog) => {
    const [userSearches, globalSearches, campaignProspects] = await Promise.all([
      prisma.search.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 100, select: { results: true } }),
      prisma.search.findMany({ orderBy: { createdAt: 'desc' }, take: 200, select: { results: true, userId: true } }),
      prisma.campaignProspect.findMany({ where: { campaign: { userId: user.id } }, select: { channelId: true } }),
    ])
    const seenChannelIds = extractChannelIdsFromSearchResults(userSearches)
    const globalExposure = countGlobalChannelExposure(globalSearches)
    const catalogIds = new Set(sourceCatalog.channels.map(channel => String(channel.id || channel.channelId || '')).filter(Boolean))
    const usersExposedCount = new Set(globalSearches.filter(row => Array.from(extractChannelIdsFromSearchResults([row])).some(id => catalogIds.has(id))).map(row => row.userId)).size
    const diversified = diversifyProspects({
      channels,
      seenChannelIds,
      campaignChannelIds: new Set(campaignProspects.map(item => item.channelId)),
      globalExposure,
      userSeed: user.id,
      targetKey: buildExposureTargetKey(parsed.target, parsed.minVal, parsed.maxVal),
      limit: Math.min(50, channels.length),
    })
    const coverage = calculateCatalogCoverage({
      channels: sourceCatalog.channels,
      matchedChannels: channels,
      globalExposure,
      newlyDiscoveredThisRun: sourceCatalog.newlyDiscoveredThisRun,
      alreadyKnownThisRun: sourceCatalog.alreadyKnownThisRun,
      rawVideoResults: sourceCatalog.rawVideoResults,
      duplicateVideoResults: sourceCatalog.duplicateVideoResults,
      previous: sourceCatalog.coverage,
      usersExposedCount,
    })
    return { ...diversified, coverage, userCoverage: getUserCoverage(channels, seenChannelIds) }
  }

  const logSearch = (extra: Record<string, unknown>) => console.info('YouTube catalog event:', {
    queryVariantCount: metrics.searchQueriesUsed,
    searchListCalls: metrics.searchList,
    rawVideoResults: metrics.rawCandidates,
    uniqueChannelIds: metrics.uniqueCandidates,
    channelCatalogCandidates: 0,
    rejectedBySubscribers: metrics.hiddenSubscribers + metrics.belowMinimum + metrics.aboveMaximum,
    rejectedByLanguage: metrics.rejectedLanguage,
    rejectedByNiche: metrics.rejectedNiche,
    strictSubnicheMatches: 0,
    nearbySubnicheMatches: 0,
    displayedResults: 0,
    catalogHit: false,
    durationMs: Date.now() - startedAt,
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

    let catalogResults = catalog ? filterYouTubeCatalog(catalog, parsed.minVal, parsed.maxVal, 150, parsed.target) : []
    const cachedSelection = catalog ? await selectVisibleResults(catalogResults, catalog) : null
    const enrichmentTriggered = Boolean(catalog && shouldEnrichSearchCatalog({
      candidateCount: catalog.channels.length,
      filteredResultCount: catalogResults.length,
      collectedAt: catalog.collectedAt,
      newForUser: cachedSelection?.userCoverage.newForUser,
      coverageRate: cachedSelection?.coverage.coverageRate,
    }))
    const negativeCatalogHit = Boolean(catalog && catalog.channels.length === 0)

    if (catalog && !enrichmentTriggered) {
      if (catalogResults.length === 0) {
        await releaseSearchQuota(prisma, parsed.requestId)
        reserved = false
        const emptyQuota = getReleasedSearchQuotaSnapshot(reservation.snapshot)
        responseStatus = 200
        logSearch({ catalogHit: true, rawVideoResults: catalog.rawVideoResults || 0, uniqueChannelIds: catalog.channels.length, channelCatalogCandidates: catalog.channels.length, ...getCatalogLogDetails(catalog) })
        return NextResponse.json({
          results: [], source: 'catalog', cached: true, emptyResult: true,
          searchesRemaining: emptyQuota.remaining, quota: emptyQuota, plan,
          canGenerateEmail: limits.emailAI,
        })
      }
      const selection = cachedSelection || await selectVisibleResults(catalogResults, catalog)
      catalog.coverage = selection.coverage
      const visibleResults = selection.results
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
      logSearch({
        catalogHit: true,
        rawVideoResults: catalog.rawVideoResults || 0,
        uniqueChannelIds: catalog.channels.length,
        channelCatalogCandidates: catalog.channels.length,
        strictSubnicheMatches: catalogResults.filter(item => item.matchMode !== 'nearby').length,
        nearbySubnicheMatches: catalogResults.filter(item => item.matchMode === 'nearby').length,
        displayedResults: Math.min(20, visibleResults.length),
        userNewResults: selection.newCount,
        userSeenResults: selection.seenCount,
        ...getCatalogLogDetails(catalog),
      })
      return NextResponse.json({
        results: visibleResults,
        resultMeta: buildResultMeta(visibleResults),
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
    catalogResults = filterYouTubeCatalog(catalog, parsed.minVal, parsed.maxVal, 150, parsed.target)
    const selection = await selectVisibleResults(catalogResults, catalog)
    catalog.coverage = selection.coverage
    const visibleResults = selection.results

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
      logSearch({ catalogHit, rawVideoResults: catalog.rawVideoResults || metrics.rawCandidates, uniqueChannelIds: catalog.channels.length, channelCatalogCandidates: catalog.channels.length, ...getCatalogLogDetails(catalog) })
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
    logSearch({
      catalogHit,
      rawVideoResults: catalog.rawVideoResults || metrics.rawCandidates,
      uniqueChannelIds: catalog.channels.length,
      channelCatalogCandidates: catalog.channels.length,
      strictSubnicheMatches: catalogResults.filter(item => item.matchMode !== 'nearby').length,
      nearbySubnicheMatches: catalogResults.filter(item => item.matchMode === 'nearby').length,
      displayedResults: Math.min(20, visibleResults.length),
      userNewResults: selection.newCount,
      userSeenResults: selection.seenCount,
      ...getCatalogLogDetails(catalog),
    })
    return NextResponse.json({
      results: visibleResults,
      resultMeta: buildResultMeta(visibleResults),
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
