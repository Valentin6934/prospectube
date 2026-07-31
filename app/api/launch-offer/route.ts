import { NextResponse } from 'next/server'
import { getLaunchOfferStatusFromStripe } from '@/lib/launchOfferServer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await getLaunchOfferStatusFromStripe()
  return NextResponse.json(status, {
    headers: {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=30',
    },
  })
}
