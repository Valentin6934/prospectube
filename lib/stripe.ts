import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY est manquante.')

  if (!stripeClient) stripeClient = new Stripe(secretKey)
  return stripeClient
}

export function getAppUrl(requestUrl: string) {
  const configuredUrl = process.env.NEXTAUTH_URL?.trim()
  return (configuredUrl || new URL(requestUrl).origin).replace(/\/$/, '')
}
