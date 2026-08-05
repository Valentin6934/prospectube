import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { FREE_LIFETIME_SEARCH_LIMIT } from '@/lib/searchPolicy'
import { classifyRegistrationError, validateRegistrationInput } from '@/lib/registration'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let step: 'validate' | 'findExistingUser' | 'hashPassword' | 'createUser' = 'validate'
  const body = await req.json().catch(() => null)
  const validated = validateRegistrationInput(body)
  if (!validated.ok) {
    return NextResponse.json({
      error: 'Veuillez verifier les informations saisies.',
      code: 'REGISTRATION_INVALID_INPUT',
    }, { status: 400 })
  }

  const { name, email, password } = validated.data
  try {
    step = 'findExistingUser'
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) {
      return NextResponse.json({
        error: 'Un compte existe deja avec cette adresse.',
        code: 'REGISTRATION_EMAIL_ALREADY_EXISTS',
      }, { status: 409 })
    }

    step = 'hashPassword'
    const hashed = await bcrypt.hash(password, 10)
    step = 'createUser'
    const user = await prisma.user.create({
      data: { name, email, password: hashed, plan: 'Gratuit', searchesRemaining: FREE_LIFETIME_SEARCH_LIMIT },
      select: { id: true },
    })
    return NextResponse.json({ success: true, userId: user.id })
  } catch (error) {
    const failure = classifyRegistrationError(error)
    console.error({
      event: 'registration_failed',
      code: failure.code,
      errorName: failure.errorName,
      prismaCode: failure.prismaCode,
      meta: failure.safeMeta,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      step,
      status: failure.status,
    })
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status })
  }
}
