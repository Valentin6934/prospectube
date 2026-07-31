import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAppUrl, getStripe } from '@/lib/stripe'
import {
  STRIPE_CLIENT_ERROR_MESSAGE,
  StripeConfigError,
  getSafeStripeConfigLog,
  getValidatedStripeConfig,
  toStripeConfigError,
  validateStripePriceForPro,
} from '@/lib/stripeConfig'

export const dynamic = 'force-dynamic'

function logStripeCheckoutConfigError(error: StripeConfigError, context: Record<string, unknown> = {}) {
  console.error('POST /api/stripe/checkout configuration error:', {
    ...context,
    ...getSafeStripeConfigLog(error),
  })
}

function stripeConfigErrorResponse(error: StripeConfigError) {
  return NextResponse.json(
    {
      error: STRIPE_CLIENT_ERROR_MESSAGE,
      code: error.code,
      ...(error.code === 'STRIPE_PRICE_NOT_FOUND'
        ? {
            priceId: error.priceId,
            mode: error.mode,
          }
        : {}),
    },
    { status: error.status }
  )
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non connecte' }, { status: 401 })
    }

    const { priceId, mode } = getValidatedStripeConfig()

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    })
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    if (user.stripeSubscriptionId) {
      return NextResponse.json({ error: 'Un abonnement Stripe existe deja.' }, { status: 409 })
    }

    const appUrl = getAppUrl(req.url)
    const stripe = getStripe()
    const account = await stripe.accounts.retrieve(null)

    let price
    try {
      price = await stripe.prices.retrieve(priceId)
    } catch (error) {
      const configError = toStripeConfigError(error)
      configError.priceId = priceId
      configError.mode = mode
      logStripeCheckoutConfigError(configError, {
        stripeAccountId: account.id,
        priceId,
        mode,
      })
      return stripeConfigErrorResponse(configError)
    }

    try {
      validateStripePriceForPro(price, mode)
    } catch (error) {
      const configError = toStripeConfigError(error)
      logStripeCheckoutConfigError(configError, {
        stripeAccountId: account.id,
        priceId,
        priceLivemode: price.livemode,
        priceActive: price.active,
        unitAmount: price.unit_amount,
        currency: price.currency,
        recurringInterval: price.recurring?.interval,
        mode,
      })
      return stripeConfigErrorResponse(configError)
    }

    console.info('POST /api/stripe/checkout price verified:', {
      stripeAccountId: account.id,
      priceId,
      priceLivemode: price.livemode,
      priceActive: price.active,
      unitAmount: price.unit_amount,
      currency: price.currency,
      recurringInterval: price.recurring?.interval,
      mode,
    })

    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/home?success=pro`,
      cancel_url: `${appUrl}/dashboard/home?canceled=true`,
      client_reference_id: user.id,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
      ...(user.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: user.email }),
    })

    if (!checkout.url) {
      return NextResponse.json({ error: 'Stripe n a pas retourne d URL de paiement.' }, { status: 502 })
    }

    return NextResponse.json({ url: checkout.url })
  } catch (error) {
    const configError = toStripeConfigError(error)
    if (configError.code !== 'STRIPE_CONFIGURATION_ERROR' || error instanceof StripeConfigError) {
      logStripeCheckoutConfigError(configError)
      return stripeConfigErrorResponse(configError)
    }

    console.error('POST /api/stripe/checkout error:', {
      message: configError.message,
      stripeRequestId: configError.stripeRequestId,
      stripeType: configError.stripeType,
    })
    return NextResponse.json({ error: STRIPE_CLIENT_ERROR_MESSAGE }, { status: 500 })
  }
}
