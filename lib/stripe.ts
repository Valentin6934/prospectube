import Stripe from 'stripe'
import { validateStripeSecretKey } from './stripeConfig'

let stripeClient: Stripe | null = null

export function getStripe() {
  const { secretKey } = validateStripeSecretKey(process.env.STRIPE_SECRET_KEY)

  if (!stripeClient) stripeClient = new Stripe(secretKey)
  return stripeClient
}

export function getAppUrl(requestUrl: string) {
  const configuredUrl = process.env.NEXTAUTH_URL?.trim()
  return (configuredUrl || new URL(requestUrl).origin).replace(/\/$/, '')
}
