import { Prisma, PrismaClient } from '@prisma/client'
import { PRODUCT_LIMITS } from './product'

export const FREE_LIFETIME_CAMPAIGN_LIMIT = PRODUCT_LIMITS.freeCampaigns
export const FREE_CAMPAIGN_PROSPECT_LIMIT = PRODUCT_LIMITS.freeCampaignProspects
export const FREE_CAMPAIGN_MARKER_PERIOD = 'free-campaign'

type DbClient = PrismaClient | Prisma.TransactionClient

export async function hasUsedFreeCampaign(db: DbClient, userId: string): Promise<boolean> {
  const [markerCount, campaignCount] = await Promise.all([
    db.searchUsage.count({ where: { userId, periodKey: FREE_CAMPAIGN_MARKER_PERIOD, status: 'succeeded' } }),
    db.campaign.count({ where: { userId } }),
  ])
  return markerCount > 0 || campaignCount > 0
}

export async function markFreeCampaignUsed(db: DbClient, userId: string, campaignId: string) {
  await db.searchUsage.create({ data: {
    userId,
    requestId: `free-campaign:${userId}`,
    cacheKey: campaignId,
    plan: 'Gratuit',
    periodKey: FREE_CAMPAIGN_MARKER_PERIOD,
    status: 'succeeded',
    completedAt: new Date(),
  } })
}

export async function canUseFreeCampaign(db: DbClient, userId: string, campaignId: string): Promise<boolean> {
  const campaign = await db.campaign.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true } })
  return campaign?.id === campaignId
}

export function freeCampaignLimitResponse(message = "Vous avez teste votre premiere campagne. Passez au Plan Pro pour creer d'autres campagnes et prospecter regulierement.") {
  return Response.json({ error: 'FREE_CAMPAIGN_LIMIT', upgrade: true, message }, { status: 403 })
}
