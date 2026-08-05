export type RegistrationInput = {
  name: string
  email: string
  password: string
}

export type RegistrationErrorInfo = {
  code: 'REGISTRATION_EMAIL_ALREADY_EXISTS' | 'REGISTRATION_DATABASE_SCHEMA_ERROR' | 'REGISTRATION_DATABASE_UNAVAILABLE' | 'REGISTRATION_INTERNAL_ERROR'
  status: 409 | 500 | 503
  message: string
  prismaCode?: string
  errorName: string
  safeMeta?: Record<string, string | string[]>
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATABASE_UNAVAILABLE_CODES = new Set(['P1000', 'P1001', 'P1002', 'P1008', 'P1017'])

export function normalizeAccountEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function validateRegistrationInput(value: unknown): { ok: true; data: RegistrationInput } | { ok: false } {
  if (!value || typeof value !== 'object') return { ok: false }
  const input = value as Record<string, unknown>
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const email = normalizeAccountEmail(input.email)
  const password = typeof input.password === 'string' ? input.password : ''

  if (!name || name.length > 100 || !email || email.length > 254 || !EMAIL_PATTERN.test(email)) return { ok: false }
  if (password.length < 6 || password.length > 128) return { ok: false }
  return { ok: true, data: { name, email, password } }
}

function readString(error: unknown, key: string): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const value = (error as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

function safeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const identifier = value.split('.').pop()?.replace(/["'`]/g, '').trim()
  return identifier && /^[A-Za-z][A-Za-z0-9_]*$/.test(identifier) ? identifier : undefined
}

export function getSafePrismaMeta(error: unknown): Record<string, string | string[]> | undefined {
  if (!error || typeof error !== 'object') return undefined
  const meta = (error as { meta?: unknown }).meta
  if (!meta || typeof meta !== 'object') return undefined
  const source = meta as Record<string, unknown>
  const safe: Record<string, string | string[]> = {}
  const model = safeIdentifier(source.modelName)
  const table = safeIdentifier(source.table)
  const column = safeIdentifier(source.column)
  const target = Array.isArray(source.target)
    ? source.target.map(safeIdentifier).filter((item): item is string => Boolean(item))
    : []
  if (model) safe.model = model
  if (table) safe.table = table
  if (column) safe.column = column
  if (target.length) safe.fields = target
  return Object.keys(safe).length ? safe : undefined
}

export function classifyRegistrationError(error: unknown): RegistrationErrorInfo {
  const prismaCode = readString(error, 'code') || readString(error, 'errorCode')
  const errorName = readString(error, 'name') || 'Error'
  const safeMeta = getSafePrismaMeta(error)

  if (prismaCode === 'P2002') {
    return { code: 'REGISTRATION_EMAIL_ALREADY_EXISTS', status: 409, message: 'Un compte existe deja avec cette adresse.', prismaCode, errorName, safeMeta }
  }
  if (prismaCode === 'P2021' || prismaCode === 'P2022') {
    return { code: 'REGISTRATION_DATABASE_SCHEMA_ERROR', status: 503, message: "L'inscription est temporairement indisponible sur cet environnement.", prismaCode, errorName, safeMeta }
  }
  if (DATABASE_UNAVAILABLE_CODES.has(prismaCode || '') || errorName === 'PrismaClientInitializationError') {
    return { code: 'REGISTRATION_DATABASE_UNAVAILABLE', status: 503, message: "L'inscription est temporairement indisponible sur cet environnement.", prismaCode, errorName, safeMeta }
  }
  return { code: 'REGISTRATION_INTERNAL_ERROR', status: 500, message: "Une erreur est survenue pendant l'inscription. Reessayez.", prismaCode, errorName, safeMeta }
}
