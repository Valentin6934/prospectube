import { Prisma, PrismaClient } from '@prisma/client'
import { getSearchLimit, getUtcDayKey, getUtcDayStart, SearchPlan } from './searchPolicy'

type DbClient = PrismaClient | Prisma.TransactionClient

export type SearchQuotaSnapshot = {
  limit: number
  used: number
  remaining: number
  periodKey: string
}

export function getReleasedSearchQuotaSnapshot(snapshot: SearchQuotaSnapshot): SearchQuotaSnapshot {
  return {
    ...snapshot,
    used: Math.max(0, snapshot.used - 1),
    remaining: Math.min(snapshot.limit, snapshot.remaining + 1),
  }
}

export async function getSearchQuotaSnapshot(
  db: DbClient,
  userId: string,
  plan: SearchPlan,
  now = new Date()
): Promise<SearchQuotaSnapshot> {
  const limit = getSearchLimit(plan)
  const periodKey = plan === 'Pro' ? getUtcDayKey(now) : 'lifetime'

  if (plan === 'Gratuit') {
    const [historyCount, usageCount] = await Promise.all([
      db.search.count({ where: { userId } }),
      db.searchUsage.count({
        where: { userId, periodKey: 'lifetime', status: { in: ['pending', 'succeeded'] } },
      }),
    ])
    const used = Math.min(limit, Math.max(historyCount, usageCount))
    return { limit, used, remaining: Math.max(0, limit - used), periodKey }
  }

  const used = await db.searchUsage.count({
    where: {
      userId,
      status: { in: ['pending', 'succeeded'] },
      createdAt: { gte: getUtcDayStart(now) },
    },
  })
  return { limit, used, remaining: Math.max(0, limit - used), periodKey }
}

export async function reserveSearchQuota(input: {
  prisma: PrismaClient
  userId: string
  requestId: string
  cacheKey: string
  plan: SearchPlan
  now?: Date
}) {
  const now = input.now || new Date()

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await input.prisma.$transaction(async tx => {
        const existing = await tx.searchUsage.findUnique({ where: { requestId: input.requestId } })
        if (existing) {
          return { reserved: false as const, duplicate: true as const, snapshot: await getSearchQuotaSnapshot(tx, input.userId, input.plan, now) }
        }

        const snapshot = await getSearchQuotaSnapshot(tx, input.userId, input.plan, now)
        if (snapshot.remaining <= 0) {
          return { reserved: false as const, duplicate: false as const, snapshot }
        }

        await tx.searchUsage.create({
          data: {
            userId: input.userId,
            requestId: input.requestId,
            cacheKey: input.cacheKey,
            plan: input.plan,
            periodKey: snapshot.periodKey,
            status: 'pending',
          },
        })

        return {
          reserved: true as const,
          duplicate: false as const,
          snapshot: { ...snapshot, used: snapshot.used + 1, remaining: snapshot.remaining - 1 },
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) {
        continue
      }
      throw error
    }
  }

  throw new Error('SEARCH_QUOTA_RESERVATION_FAILED')
}

export async function completeSearchQuota(prisma: PrismaClient, requestId: string, cached: boolean) {
  await prisma.searchUsage.update({
    where: { requestId },
    data: { status: 'succeeded', cached, completedAt: new Date() },
  })
}

export async function releaseSearchQuota(prisma: PrismaClient, requestId: string) {
  await prisma.searchUsage.deleteMany({ where: { requestId, status: 'pending' } })
}

export async function acquireSearchLock(input: {
  prisma: PrismaClient
  userId: string
  requestId: string
  cacheKey: string
  expiresAt: Date
}) {
  await input.prisma.searchLock.deleteMany({ where: { expiresAt: { lt: new Date() } } })

  try {
    await input.prisma.searchLock.create({
      data: {
        userId: input.userId,
        requestId: input.requestId,
        cacheKey: input.cacheKey,
        expiresAt: input.expiresAt,
      },
    })
    return true
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false
    throw error
  }
}

export async function releaseSearchLock(prisma: PrismaClient, requestId: string) {
  await prisma.searchLock.deleteMany({ where: { requestId } })
}
