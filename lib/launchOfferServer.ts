import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import {
  buildLaunchOfferStatusFromPromotion,
  getDefaultLaunchOfferStatus,
  isLaunchPromotionId,
  LAUNCH_OFFER_CACHE_MS,
  type LaunchOfferStatus,
} from '@/lib/launchOffer'

let cachedOffer: { status: LaunchOfferStatus; expiresAt: number } | null = null

function expectedStripeLivemode() {
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith('sk_live_')
}

function safeLaunchOfferError(error: unknown) {
  return {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : 'UnknownError',
  }
}

export function clearLaunchOfferCacheForTests() {
  cachedOffer = null
}

export async function getLaunchOfferStatusFromStripe(options: { bypassCache?: boolean } = {}): Promise<LaunchOfferStatus> {
  const now = Date.now()
  if (!options.bypassCache && cachedOffer && cachedOffer.expiresAt > now) return cachedOffer.status

  const promotionId = process.env.STRIPE_LAUNCH_PROMOTION_ID?.trim()
  if (!isLaunchPromotionId(promotionId)) {
    const status = getDefaultLaunchOfferStatus()
    cachedOffer = { status, expiresAt: now + LAUNCH_OFFER_CACHE_MS }
    return status
  }

  try {
    const stripe = getStripe()
    let promotion: Stripe.PromotionCode | Stripe.Coupon

    if (promotionId.startsWith('promo_')) {
      promotion = await stripe.promotionCodes.retrieve(promotionId, {
        expand: ['coupon'],
      })
    } else {
      promotion = await stripe.coupons.retrieve(promotionId)
    }

    const status = buildLaunchOfferStatusFromPromotion(promotion as any, {
      expectedLivemode: expectedStripeLivemode(),
    })
    cachedOffer = { status, expiresAt: now + LAUNCH_OFFER_CACHE_MS }
    return status
  } catch (error) {
    console.error('GET /api/launch-offer Stripe error:', safeLaunchOfferError(error))
    const status = getDefaultLaunchOfferStatus()
    cachedOffer = { status, expiresAt: now + LAUNCH_OFFER_CACHE_MS }
    return status
  }
}

export async function getAutomaticLaunchDiscount() {
  const promotionId = process.env.STRIPE_LAUNCH_PROMOTION_ID?.trim()
  if (!isLaunchPromotionId(promotionId)) return null

  const status = await getLaunchOfferStatusFromStripe({ bypassCache: true })
  if (!status.active || status.remainingPlaces <= 0) return null

  return promotionId.startsWith('promo_')
    ? { promotion_code: promotionId }
    : { coupon: promotionId }
}
