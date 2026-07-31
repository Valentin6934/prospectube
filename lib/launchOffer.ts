export const LAUNCH_OFFER_MAX_PLACES = 5
export const LAUNCH_PRICE = 4.95
export const REGULAR_PRO_PRICE = 9.9
export const LAUNCH_OFFER_CACHE_MS = 45_000
export const LAUNCH_OFFER_PERCENT_OFF = 50

export type LaunchOfferStatus = {
  active: boolean
  launchPrice: number
  regularPrice: number
  discountedPrice: number
  originalPrice: number
  maxPlaces: number
  usedPlaces: number
  remainingPlaces: number
  remaining: number
}

type StripePromotionLike = {
  active?: boolean | null
  valid?: boolean | null
  percent_off?: number | null
  duration?: string | null
  livemode?: boolean | null
  max_redemptions?: number | null
  times_redeemed?: number | null
  expires_at?: number | null
  redeem_by?: number | null
  coupon?: {
    valid?: boolean | null
    percent_off?: number | null
    duration?: string | null
    max_redemptions?: number | null
    times_redeemed?: number | null
    redeem_by?: number | null
  } | string | null
}

export function getDefaultLaunchOfferStatus(): LaunchOfferStatus {
  return {
    active: false,
    launchPrice: LAUNCH_PRICE,
    regularPrice: REGULAR_PRO_PRICE,
    discountedPrice: LAUNCH_PRICE,
    originalPrice: REGULAR_PRO_PRICE,
    maxPlaces: LAUNCH_OFFER_MAX_PLACES,
    usedPlaces: LAUNCH_OFFER_MAX_PLACES,
    remainingPlaces: 0,
    remaining: 0,
  }
}

function isExpired(timestamp?: number | null, nowSeconds = Math.floor(Date.now() / 1000)) {
  return typeof timestamp === 'number' && timestamp > 0 && timestamp < nowSeconds
}

export function isLaunchPromotionId(value?: string | null): value is string {
  return typeof value === 'string' && /^(promo_[A-Za-z0-9_]+|coupon_[A-Za-z0-9_]+|[A-Za-z0-9-]+)$/.test(value.trim())
}

export function getLaunchOfferButtonLabel(status?: LaunchOfferStatus | null): string {
  return status?.active
    ? 'Passer à Pro — 4,95 €/mois'
    : 'Passer à Pro — 9,90 €/mois'
}

export function getLaunchOfferPricing(status?: LaunchOfferStatus | null) {
  return {
    active: Boolean(status?.active),
    mainPrice: status?.active ? '4,95 €' : '9,90 €',
    regularPrice: '9,90 €',
    period: '/mois',
    remainingPlaces: status?.active ? Math.max(0, status.remainingPlaces) : 0,
  }
}

export function buildLaunchOfferStatusFromPromotion(
  promotion: StripePromotionLike | null | undefined,
  options: { expectedLivemode?: boolean; nowSeconds?: number } = {}
): LaunchOfferStatus {
  const fallback = getDefaultLaunchOfferStatus()
  if (!promotion) return fallback

  const coupon = typeof promotion.coupon === 'object' && promotion.coupon ? promotion.coupon : null
  const configuredMaxPlaces = promotion.max_redemptions || coupon?.max_redemptions || LAUNCH_OFFER_MAX_PLACES
  const percentOff = coupon?.percent_off ?? promotion.percent_off
  const duration = coupon?.duration ?? promotion.duration
  const maxPlaces = LAUNCH_OFFER_MAX_PLACES
  const usedPlaces = Math.max(promotion.times_redeemed || coupon?.times_redeemed || 0, 0)
  const remainingPlaces = Math.max(maxPlaces - usedPlaces, 0)
  const promotionActive = typeof promotion.active === 'boolean'
    ? promotion.active
    : promotion.valid !== false
  const livemodeMatches =
    typeof options.expectedLivemode !== 'boolean' ||
    typeof promotion.livemode !== 'boolean' ||
    promotion.livemode === options.expectedLivemode
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000)
  const active = Boolean(
    promotionActive &&
    livemodeMatches &&
    remainingPlaces > 0 &&
    configuredMaxPlaces === LAUNCH_OFFER_MAX_PLACES &&
    percentOff === LAUNCH_OFFER_PERCENT_OFF &&
    duration === 'forever' &&
    !isExpired(promotion.expires_at, nowSeconds) &&
    !isExpired(promotion.redeem_by, nowSeconds) &&
    !isExpired(coupon?.redeem_by, nowSeconds) &&
    promotion.valid !== false &&
    coupon?.valid !== false
  )

  return {
    active,
    launchPrice: LAUNCH_PRICE,
    regularPrice: REGULAR_PRO_PRICE,
    discountedPrice: LAUNCH_PRICE,
    originalPrice: REGULAR_PRO_PRICE,
    maxPlaces,
    usedPlaces,
    remainingPlaces: active ? remainingPlaces : 0,
    remaining: active ? remainingPlaces : 0,
  }
}
