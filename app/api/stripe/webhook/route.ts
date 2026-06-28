import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

function stripeId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id
  }
  return null
}

async function findUserId({
  metadataUserId,
  customerId,
  subscriptionId,
}: {
  metadataUserId?: string | null
  customerId?: string | null
  subscriptionId?: string | null
}) {
  if (metadataUserId) {
    const user = await prisma.user.findUnique({
      where: { id: metadataUserId },
      select: { id: true },
    })
    if (user) return user.id
  }

  const identifiers = [
    customerId ? { stripeCustomerId: customerId } : null,
    subscriptionId ? { stripeSubscriptionId: subscriptionId } : null,
  ].filter(Boolean) as Array<{ stripeCustomerId?: string; stripeSubscriptionId?: string }>

  if (identifiers.length === 0) return null
  const user = await prisma.user.findFirst({
    where: { OR: identifiers },
    select: { id: true },
  })
  return user?.id || null
}

async function activatePro(
  userId: string,
  customerId: string | null,
  subscriptionId: string | null
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: 'Pro',
      searchesRemaining: 200,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
    },
  })
}

async function restoreFree(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: 'Gratuit',
      searchesRemaining: 5,
      stripeSubscriptionId: null,
    },
  })
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Signature ou secret webhook manquant.' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, webhookSecret)
  } catch (error) {
    console.error('POST /api/stripe/webhook signature error:', error)
    return NextResponse.json({ error: 'Signature Stripe invalide.' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const checkout = event.data.object as Stripe.Checkout.Session
      const customerId = stripeId(checkout.customer)
      const subscriptionId = stripeId(checkout.subscription)
      const userId = await findUserId({
        metadataUserId: checkout.metadata?.userId || checkout.client_reference_id,
        customerId,
        subscriptionId,
      })

      if (userId && checkout.mode === 'subscription' && checkout.payment_status === 'paid') {
        await activatePro(userId, customerId, subscriptionId)
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = stripeId(subscription.customer)
      const userId = await findUserId({
        metadataUserId: subscription.metadata?.userId,
        customerId,
        subscriptionId: subscription.id,
      })

      if (userId) {
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          await activatePro(userId, customerId, subscription.id)
        } else if (
          subscription.status === 'canceled' ||
          subscription.status === 'unpaid' ||
          subscription.status === 'incomplete_expired'
        ) {
          await restoreFree(userId)
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const userId = await findUserId({
        metadataUserId: subscription.metadata?.userId,
        customerId: stripeId(subscription.customer),
        subscriptionId: subscription.id,
      })
      if (userId) await restoreFree(userId)
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice
      const invoiceData = invoice as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null
        parent?: {
          subscription_details?: {
            subscription?: string | Stripe.Subscription | null
            metadata?: Record<string, string>
          } | null
        } | null
      }
      const subscriptionId =
        stripeId(invoiceData.subscription) ||
        stripeId(invoiceData.parent?.subscription_details?.subscription)
      const userId = await findUserId({
        metadataUserId: invoiceData.parent?.subscription_details?.metadata?.userId,
        customerId: stripeId(invoice.customer),
        subscriptionId,
      })

      if (userId) await activatePro(userId, stripeId(invoice.customer), subscriptionId)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`POST /api/stripe/webhook ${event.type} error:`, error)
    return NextResponse.json({ error: 'Traitement du webhook Stripe impossible.' }, { status: 500 })
  }
}
