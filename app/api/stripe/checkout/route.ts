import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAppUrl, getStripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

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
    const checkout = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/home?success=pro`,
      cancel_url: `${appUrl}/dashboard/home?canceled=true`,
      client_reference_id: user.id,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
      allow_promotion_codes: true,
      ...(user.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: user.email }),
    })

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
