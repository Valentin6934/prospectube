import type Stripe from 'stripe'

export type StripeMode = 'live' | 'test'

export const STRIPE_CLIENT_ERROR_MESSAGE =
  'Le paiement est temporairement indisponible. La configuration Stripe doit etre verifiee.'

export type StripeConfigErrorCode =
  | 'STRIPE_SECRET_KEY_MISSING'
  | 'STRIPE_SECRET_KEY_INVALID'
  | 'STRIPE_PRICE_PRO_MISSING'
  | 'STRIPE_PRICE_PRO_INVALID'
  | 'STRIPE_PUBLISHABLE_KEY_INVALID'
  | 'STRIPE_MODE_MISMATCH'
  | 'STRIPE_PRICE_NOT_FOUND'
  | 'STRIPE_PRICE_INACTIVE'
  | 'STRIPE_PRICE_INTERVAL_INVALID'
  | 'STRIPE_PRICE_CURRENCY_INVALID'
  | 'STRIPE_PRICE_AMOUNT_INVALID'
  | 'STRIPE_CONFIGURATION_ERROR'

export class StripeConfigError extends Error {
  code: StripeConfigErrorCode
  status: number
  priceId?: string
  mode?: StripeMode
  stripeRequestId?: string
  stripeType?: string

  constructor(
    code: StripeConfigErrorCode,
    message: string,
    options: {
      status?: number
      priceId?: string
      mode?: StripeMode
      stripeRequestId?: string
      stripeType?: string
    } = {}
  ) {
    super(message)
    this.name = 'StripeConfigError'
    this.code = code
    this.status = options.status ?? 500
    this.priceId = options.priceId
    this.mode = options.mode
    this.stripeRequestId = options.stripeRequestId
    this.stripeType = options.stripeType
  }
}

export function getStripeModeFromSecret(secretKey: string): StripeMode | null {
  if (secretKey.startsWith('sk_live_')) return 'live'
  if (secretKey.startsWith('sk_test_')) return 'test'
  return null
}

export function getStripeModeFromPublishableKey(publishableKey: string): StripeMode | null {
  if (publishableKey.startsWith('pk_live_')) return 'live'
  if (publishableKey.startsWith('pk_test_')) return 'test'
  return null
}

export function validateStripeSecretKey(value: string | undefined) {
  const secretKey = value?.trim()
  if (!secretKey) {
    throw new StripeConfigError('STRIPE_SECRET_KEY_MISSING', 'STRIPE_SECRET_KEY est manquante.')
  }

  const mode = getStripeModeFromSecret(secretKey)
  if (!mode) {
    throw new StripeConfigError(
      'STRIPE_SECRET_KEY_INVALID',
      'STRIPE_SECRET_KEY doit commencer par sk_test_ ou sk_live_.'
    )
  }

  return { secretKey, mode }
}

export function validateStripePriceId(value: string | undefined) {
  const priceId = value?.trim()
  if (!priceId) {
    throw new StripeConfigError('STRIPE_PRICE_PRO_MISSING', 'STRIPE_PRICE_PRO est manquant.')
  }

  if (!priceId.startsWith('price_')) {
    const invalidPrefix = ['sk_live_', 'sk_test_', 'prod_', 'coupon_', 'promo_'].some(prefix =>
      priceId.startsWith(prefix)
    )
    throw new StripeConfigError(
      'STRIPE_PRICE_PRO_INVALID',
      invalidPrefix
        ? 'STRIPE_PRICE_PRO doit contenir un identifiant price_, pas une cle ou une promotion Stripe.'
        : 'STRIPE_PRICE_PRO doit commencer par price_.'
    )
  }

  return priceId
}

export function validateStripePublishableKey(value: string | undefined) {
  const publishableKey = value?.trim()
  if (!publishableKey) return null

  const mode = getStripeModeFromPublishableKey(publishableKey)
  if (!mode) {
    throw new StripeConfigError(
      'STRIPE_PUBLISHABLE_KEY_INVALID',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY doit commencer par pk_test_ ou pk_live_.'
    )
  }

  return { publishableKey, mode }
}

export function getValidatedStripeConfig(env: NodeJS.ProcessEnv = process.env) {
  const { secretKey, mode } = validateStripeSecretKey(env.STRIPE_SECRET_KEY)
  const priceId = validateStripePriceId(env.STRIPE_PRICE_PRO)
  const publishable = validateStripePublishableKey(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)

  if (publishable && publishable.mode !== mode) {
    throw new StripeConfigError(
      'STRIPE_MODE_MISMATCH',
      'Les modes Stripe secret et publishable ne correspondent pas.',
      { mode, priceId }
    )
  }

  return {
    secretKey,
    priceId,
    mode,
    publishableKey: publishable?.publishableKey ?? null,
  }
}

export function getStripeErrorRequestId(error: unknown) {
  const stripeError = error as { requestId?: unknown; request_id?: unknown }
  return typeof stripeError.requestId === 'string'
    ? stripeError.requestId
    : typeof stripeError.request_id === 'string'
      ? stripeError.request_id
      : undefined
}

export function getStripeErrorType(error: unknown) {
  const stripeError = error as { type?: unknown }
  return typeof stripeError.type === 'string' ? stripeError.type : undefined
}

export function isStripeResourceMissingError(error: unknown) {
  const stripeError = error as { code?: unknown; type?: unknown; message?: unknown }
  return (
    stripeError.code === 'resource_missing' ||
    (typeof stripeError.message === 'string' && /No such price/i.test(stripeError.message))
  )
}

export function sanitizeStripeMessage(message: string) {
  return message
    .replace(/sk_(live|test)_[A-Za-z0-9_]+/g, 'sk_$1_[redacted]')
    .replace(/pk_(live|test)_[A-Za-z0-9_]+/g, 'pk_$1_[redacted]')
}

export function validateStripePriceForPro(price: Stripe.Price, expectedMode: StripeMode) {
  const priceId = price.id
  if (price.livemode !== (expectedMode === 'live')) {
    throw new StripeConfigError(
      'STRIPE_MODE_MISMATCH',
      'Le Price Stripe ne correspond pas au mode de la cle configuree.',
      { priceId, mode: expectedMode }
    )
  }

  if (!price.active) {
    throw new StripeConfigError('STRIPE_PRICE_INACTIVE', 'Le Price Stripe Pro est inactif.', {
      priceId,
      mode: expectedMode,
    })
  }

  if (price.recurring?.interval !== 'month') {
    throw new StripeConfigError(
      'STRIPE_PRICE_INTERVAL_INVALID',
      'Le Price Stripe Pro doit etre recurrent mensuel.',
      { priceId, mode: expectedMode }
    )
  }

  if (price.currency !== 'eur') {
    throw new StripeConfigError('STRIPE_PRICE_CURRENCY_INVALID', 'Le Price Stripe Pro doit etre en EUR.', {
      priceId,
      mode: expectedMode,
    })
  }

  if (price.unit_amount !== 490) {
    throw new StripeConfigError(
      'STRIPE_PRICE_AMOUNT_INVALID',
      'Le Price Stripe Pro doit etre de 490 centimes.',
      { priceId, mode: expectedMode }
    )
  }
}

export function toStripeConfigError(error: unknown, fallbackCode: StripeConfigErrorCode = 'STRIPE_CONFIGURATION_ERROR') {
  if (error instanceof StripeConfigError) return error

  if (isStripeResourceMissingError(error)) {
    const stripeError = error as { message?: unknown }
    return new StripeConfigError(
      'STRIPE_PRICE_NOT_FOUND',
      'Le tarif Stripe n existe pas pour la cle et le compte actuellement configures.',
      {
        stripeRequestId: getStripeErrorRequestId(error),
        stripeType: getStripeErrorType(error),
      }
    )
  }

  const message = error instanceof Error ? sanitizeStripeMessage(error.message) : 'Configuration Stripe invalide.'
  return new StripeConfigError(fallbackCode, message, {
    stripeRequestId: getStripeErrorRequestId(error),
    stripeType: getStripeErrorType(error),
  })
}

export function getSafeStripeConfigLog(error: StripeConfigError) {
  return {
    code: error.code,
    message: error.message,
    priceId: error.priceId,
    mode: error.mode,
    stripeRequestId: error.stripeRequestId,
    stripeType: error.stripeType,
  }
}
