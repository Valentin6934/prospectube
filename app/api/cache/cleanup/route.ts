import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST() {
  const deleted = await prisma.searchCache.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  })

  return NextResponse.json({ deleted: deleted.count })
}
