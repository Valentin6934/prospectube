export type YouTubeErrorCode =
  | 'YOUTUBE_KEY_INVALID'
  | 'YOUTUBE_API_DISABLED'
  | 'YOUTUBE_KEY_RESTRICTED'
  | 'YOUTUBE_PROJECT_MISMATCH'
  | 'YOUTUBE_DAILY_QUOTA_EXCEEDED'
  | 'YOUTUBE_RATE_LIMITED'
  | 'YOUTUBE_BACKEND_ERROR'
  | 'YOUTUBE_TIMEOUT'
  | 'YOUTUBE_INVALID_SEARCH_PARAMETERS'
  | 'YOUTUBE_UNKNOWN_ERROR'

export const YOUTUBE_CONFIGURATION_MESSAGE =
  "La recherche YouTube est temporairement indisponible en raison d'un probleme de configuration."
export const YOUTUBE_DAILY_QUOTA_MESSAGE =
  "La limite quotidienne de recherches YouTube a ete atteinte. Reessayez apres sa reinitialisation."
export const YOUTUBE_RATE_LIMIT_MESSAGE =
  'Trop de recherches ont ete lancees en peu de temps. Patientez quelques instants.'
export const YOUTUBE_BACKEND_ERROR_MESSAGE =
  'YouTube rencontre temporairement un probleme. Reessayez dans quelques instants.'
export const YOUTUBE_GENERIC_ERROR_MESSAGE =
  'La recherche YouTube a echoue. Reessayez dans quelques instants.'
export const YOUTUBE_INVALID_SEARCH_PARAMETERS_MESSAGE =
  'La recherche contient un critere non pris en charge. Modifiez les criteres et reessayez.'

const CONFIGURATION_CODES = new Set<YouTubeErrorCode>([
  'YOUTUBE_KEY_INVALID',
  'YOUTUBE_API_DISABLED',
  'YOUTUBE_KEY_RESTRICTED',
  'YOUTUBE_PROJECT_MISMATCH',
])

export class YouTubeApiError extends Error {
  code: YouTubeErrorCode
  status: number
  reason?: string
  endpoint?: string
  httpStatus?: number
  retryable: boolean
  consumerProjectNumber?: string
  requestId?: string

  constructor(code: YouTubeErrorCode, message: string, options: {
    status?: number
    reason?: string
    endpoint?: string
    httpStatus?: number
    retryable?: boolean
    consumerProjectNumber?: string
    requestId?: string
  } = {}) {
    super(message)
    this.name = 'YouTubeApiError'
    this.code = code
    this.status = options.status ?? 500
    this.reason = options.reason
    this.endpoint = options.endpoint
    this.httpStatus = options.httpStatus
    this.retryable = options.retryable ?? false
    this.consumerProjectNumber = options.consumerProjectNumber
    this.requestId = options.requestId
  }
}

export function sanitizeGoogleMessage(message: string) {
  return String(message || '')
    .replace(/AIza[0-9A-Za-z_-]+/g, '[redacted_api_key]')
    .replace(/([?&]key=)[^&\s]+/g, '$1[redacted]')
    .replace(/projects?\/[0-9A-Za-z_-]+/gi, 'project/[redacted]')
    .replace(/consumer:\s*projects?\/[0-9A-Za-z_-]+/gi, 'consumer: project/[redacted]')
}

export function extractGoogleReason(payload: any): string | undefined {
  const errors = payload?.error?.errors
  if (Array.isArray(errors)) {
    const reason = errors.find((item: any) => typeof item?.reason === 'string')?.reason
    if (reason) return reason
  }
  const details = payload?.error?.details
  if (Array.isArray(details)) {
    for (const detail of details) {
      const reason = detail?.reason || detail?.metadata?.reason
      if (typeof reason === 'string') return reason
    }
  }
  return typeof payload?.error?.status === 'string' ? payload.error.status : undefined
}

export function extractConsumerProjectNumber(payload: any): string | undefined {
  const serialized = JSON.stringify(payload || {})
  const match = serialized.match(/(?:consumer(?:\\?"|\s|:)+projects?\/|projects\/)(\d{4,})/i)
  return match?.[1]
}

export function extractGoogleRequestId(payload: any, headers?: Headers): string | undefined {
  const headerId = headers?.get('x-request-id') || headers?.get('x-guploader-uploadid')
  if (headerId) return headerId
  const value = payload?.error?.requestId || payload?.error?.details?.find?.((item: any) => item?.requestId)?.requestId
  return typeof value === 'string' ? value : undefined
}

function matches(reason: string | undefined, values: string[]) {
  const normalized = String(reason || '').toLowerCase()
  return values.some(value => normalized === value.toLowerCase())
}

export function classifyYouTubeError(input: {
  payload?: any
  status?: number
  endpoint?: string
  fallbackMessage?: string
  expectedProjectNumber?: string
  headers?: Headers
  timedOut?: boolean
}) {
  const reason = extractGoogleReason(input.payload)
  const rawMessage = typeof input.payload?.error?.message === 'string'
    ? input.payload.error.message
    : input.fallbackMessage || 'Erreur YouTube.'
  const message = sanitizeGoogleMessage(rawMessage)
  const consumerProjectNumber = extractConsumerProjectNumber(input.payload)
  const expectedProjectNumber = input.expectedProjectNumber?.trim()
  const requestId = extractGoogleRequestId(input.payload, input.headers)
  const common = {
    reason,
    endpoint: input.endpoint,
    httpStatus: input.status,
    consumerProjectNumber,
    requestId,
  }

  if (input.timedOut) {
    return new YouTubeApiError('YOUTUBE_TIMEOUT', YOUTUBE_BACKEND_ERROR_MESSAGE, {
      ...common, status: 503, retryable: true,
    })
  }

  if (expectedProjectNumber && consumerProjectNumber && expectedProjectNumber !== consumerProjectNumber) {
    return new YouTubeApiError('YOUTUBE_PROJECT_MISMATCH', YOUTUBE_CONFIGURATION_MESSAGE, {
      ...common, status: 503,
    })
  }

  if (matches(reason, ['keyInvalid', 'badRequest']) && /key|credential/i.test(rawMessage)) {
    return new YouTubeApiError('YOUTUBE_KEY_INVALID', YOUTUBE_CONFIGURATION_MESSAGE, { ...common, status: 503 })
  }

  if (matches(reason, ['accessNotConfigured', 'serviceDisabled', 'projectNotLinked'])) {
    return new YouTubeApiError('YOUTUBE_API_DISABLED', YOUTUBE_CONFIGURATION_MESSAGE, { ...common, status: 503 })
  }

  if (matches(reason, ['ipRefererBlocked', 'forbidden', 'keyExpired']) ||
      /referer|referrer|ip address|restriction|not authorized/i.test(rawMessage)) {
    return new YouTubeApiError('YOUTUBE_KEY_RESTRICTED', YOUTUBE_CONFIGURATION_MESSAGE, { ...common, status: 503 })
  }

  if (matches(reason, ['quotaExceeded', 'dailyLimitExceeded'])) {
    return new YouTubeApiError('YOUTUBE_DAILY_QUOTA_EXCEEDED', YOUTUBE_DAILY_QUOTA_MESSAGE, {
      ...common, status: 429, retryable: true,
    })
  }

  if (matches(reason, ['rateLimitExceeded', 'userRateLimitExceeded'])) {
    return new YouTubeApiError('YOUTUBE_RATE_LIMITED', YOUTUBE_RATE_LIMIT_MESSAGE, {
      ...common, status: 429, retryable: true,
    })
  }

  if (matches(reason, ['invalidParameter', 'invalidRelevanceLanguage', 'invalidSearchFilter'])) {
    return new YouTubeApiError(
      'YOUTUBE_INVALID_SEARCH_PARAMETERS',
      YOUTUBE_INVALID_SEARCH_PARAMETERS_MESSAGE,
      { ...common, status: 400 }
    )
  }

  if (matches(reason, ['backendError', 'internalError']) || input.status === 500 || input.status === 502 || input.status === 503) {
    return new YouTubeApiError('YOUTUBE_BACKEND_ERROR', YOUTUBE_BACKEND_ERROR_MESSAGE, {
      ...common, status: 503, retryable: true,
    })
  }

  return new YouTubeApiError('YOUTUBE_UNKNOWN_ERROR', message, {
    ...common,
    status: input.status && input.status >= 400 ? input.status : 500,
  })
}

export function getSafeYouTubeLog(error: unknown) {
  if (error instanceof YouTubeApiError) {
    const log: Record<string, unknown> = {
      code: error.code,
      reason: error.reason,
      endpoint: error.endpoint,
      httpStatus: error.httpStatus,
      retryable: error.retryable,
    }
    if (error.consumerProjectNumber) log.consumerProjectNumber = error.consumerProjectNumber
    if (error.requestId) log.requestId = error.requestId
    return log
  }
  return {
    code: 'YOUTUBE_UNKNOWN_ERROR',
    message: error instanceof Error ? sanitizeGoogleMessage(error.message) : 'Erreur inconnue YouTube.',
  }
}

export function buildYouTubeErrorResponse(error: unknown) {
  if (error instanceof YouTubeApiError) {
    const message = CONFIGURATION_CODES.has(error.code)
      ? YOUTUBE_CONFIGURATION_MESSAGE
      : error.code === 'YOUTUBE_UNKNOWN_ERROR'
        ? YOUTUBE_GENERIC_ERROR_MESSAGE
        : error.message
    return {
      body: { error: error.code, message, retryable: error.retryable, source: 'youtube_error' },
      status: CONFIGURATION_CODES.has(error.code) ? 503 : error.status,
    }
  }
  return {
    body: { error: 'YOUTUBE_UNKNOWN_ERROR', message: YOUTUBE_GENERIC_ERROR_MESSAGE, retryable: false, source: 'youtube_error' },
    status: 500,
  }
}
