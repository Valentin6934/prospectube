import fs from 'node:fs'
import path from 'node:path'
import Stripe from 'stripe'

const root = process.cwd()

function readEnvFile(fileName) {
  const filePath = path.join(root, fileName)
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key]) continue
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '').trim()
  }
}

readEnvFile('.env')
readEnvFile('.env.local')

function modeFromSecret(secretKey) {
  if (secretKey.startsWith('sk_live_')) return 'live'
  if (secretKey.startsWith('sk_test_')) return 'test'
  return null
}

function fail(code, message, details = {}) {
  console.error(JSON.stringify({ ok: false, code, message: sanitize(message), ...details }, null, 2))
  process.exitCode = 1
}

function sanitize(message) {
  return message
    .replace(/sk_(live|test)_[A-Za-z0-9_]+/g, 'sk_$1_[redacted]')
    .replace(/pk_(live|test)_[A-Za-z0-9_]+/g, 'pk_$1_[redacted]')
}

const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
const priceId = process.env.STRIPE_PRICE_PRO?.trim()

if (!secretKey) {
  fail('STRIPE_SECRET_KEY_MISSING', 'STRIPE_SECRET_KEY est manquante.')
} else if (!modeFromSecret(secretKey)) {
  fail('STRIPE_SECRET_KEY_INVALID', 'STRIPE_SECRET_KEY doit commencer par sk_test_ ou sk_live_.')
} else if (!priceId) {
  fail('STRIPE_PRICE_PRO_MISSING', 'STRIPE_PRICE_PRO est manquant.', { mode: modeFromSecret(secretKey) })
} else if (!priceId.startsWith('price_')) {
  fail('STRIPE_PRICE_PRO_INVALID', 'STRIPE_PRICE_PRO doit commencer par price_.', {
    mode: modeFromSecret(secretKey),
  })
}

if (process.exitCode) process.exit()

const mode = modeFromSecret(secretKey)
const stripe = new Stripe(secretKey)

try {
  const account = await stripe.accounts.retrieve(null)
  const price = await stripe.prices.retrieve(priceId)

  console.log(JSON.stringify({
    ok: true,
    stripeAccountId: account.id,
    mode,
    priceId: price.id,
    priceLivemode: price.livemode,
    active: price.active,
    unitAmount: price.unit_amount,
    currency: price.currency,
    recurringInterval: price.recurring?.interval ?? null,
  }, null, 2))
} catch (error) {
  const stripeError = error ?? {}
  const message = error instanceof Error ? error.message : 'Diagnostic Stripe impossible.'
  fail(
    stripeError.code === 'resource_missing' || /No such price/i.test(message)
      ? 'STRIPE_PRICE_NOT_FOUND'
      : 'STRIPE_CONFIGURATION_ERROR',
    message,
    {
      mode,
      priceId,
      stripeRequestId: typeof stripeError.requestId === 'string' ? stripeError.requestId : undefined,
      stripeType: typeof stripeError.type === 'string' ? stripeError.type : undefined,
    }
  )
}
