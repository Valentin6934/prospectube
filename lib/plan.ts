export function isPro(plan?: string | null): boolean {
  return typeof plan === 'string' && plan.trim().toLowerCase() === 'pro'
}

export function isFree(plan?: string | null): boolean {
  return !isPro(plan)
}

export function getPlanName(plan?: string | null): 'Gratuit' | 'Pro' {
  return isPro(plan) ? 'Pro' : 'Gratuit'
}

export function requireProResponse() {
  return Response.json(
    {
      error: 'PRO_REQUIRED',
      upgrade: true,
      message: 'Cette fonctionnalité est réservée au plan Pro.',
    },
    { status: 403 }
  )
}
