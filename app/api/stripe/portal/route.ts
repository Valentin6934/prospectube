import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAppUrl, getStripe } from '@/lib/stripe'
import { isPro, requireProResponse } from '@/lib/plan'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { plan: true, stripeCustomerId: true },
    })
    if (user && !isPro(user.plan)) return requireProResponse()
    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Aucun compte de facturation Stripe n’est associé à cet utilisateur.' },
        { status: 400 }
      )
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${getAppUrl(req.url)}/dashboard/home`,
    })

    return NextResponse.json({ url: portal.url })
  } catch (error) {
    console.error('POST /api/stripe/portal error:', error)
    const message = error instanceof Error ? error.message : 'Erreur Stripe Billing Portal.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
