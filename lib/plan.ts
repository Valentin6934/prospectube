import { NextResponse } from 'next/server'

export function isPro(plan?: string | null): boolean {
  return plan === 'Pro'
}

export function isFree(plan?: string | null): boolean {
  return !isPro(plan)
}

export function getPlanName(plan?: string | null): 'Gratuit' | 'Pro' {
  return isPro(plan) ? 'Pro' : 'Gratuit'
}

export function requireProResponse() {
  return NextResponse.json(
    {
      error: 'PRO_REQUIRED',
      upgrade: true,
      message: 'Cette fonctionnalité est réservée au plan Pro.',
    },
    { status: 403 }
  )
}
