import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import Stripe from 'stripe'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAppUrl, getStripe } from '@/lib/stripe'
import { getAutomaticLaunchDiscount } from '@/lib/launchOfferServer'

export const dynamic = 'force-dynamic'

function isStripeDiscountError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const stripeError = error as { code?: string; message?: string; param?: string }
  const message = stripeError.message || ''
  return (
    stripeError.param?.includes('discount') ||
    stripeError.code === 'resource_missing' ||
    /promotion|coupon|discount|redeem/i.test(message)
  )
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
    }

    const priceId = process.env.STRIPE_PRICE_PRO
    if (!priceId) {
      return NextResponse.json({ error: 'STRIPE_PRICE_PRO est manquant.' }, { status: 500 })
    }

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
      return NextResponse.json({ error: 'Un abonnement Stripe existe déjà.' }, { status: 409 })
    }

    const appUrl = getAppUrl(req.url)
    const launchDiscount = await getAutomaticLaunchDiscount().catch(error => {
      console.error('POST /api/stripe/checkout launch offer error:', {
        message: error instanceof Error ? error.message : String(error),
      })
      return null
    })
    const checkoutPayload: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/home?success=pro`,
      cancel_url: `${appUrl}/dashboard/home?canceled=true`,
      client_reference_id: user.id,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
      allow_promotion_codes: false,
      ...(launchDiscount ? { discounts: [launchDiscount] } : {}),
      ...(user.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: user.email }),
    }

    let checkout
    try {
      checkout = await getStripe().checkout.sessions.create(checkoutPayload)
    } catch (error) {
      if (!launchDiscount || !isStripeDiscountError(error)) throw error
      console.error('POST /api/stripe/checkout launch discount unavailable, retrying regular price:', {
        message: error instanceof Error ? error.message : String(error),
      })
      const { discounts: _discounts, ...regularCheckoutPayload } = checkoutPayload
      checkout = await getStripe().checkout.sessions.create(regularCheckoutPayload)
    }

    if (!checkout.url) {
      return NextResponse.json({ error: 'Stripe n’a pas retourné d’URL de paiement.' }, { status: 502 })
    }

    return NextResponse.json({ url: checkout.url })
  } catch (error) {
    console.error('POST /api/stripe/checkout error:', error)
    const message = error instanceof Error ? error.message : 'Erreur Stripe Checkout.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
