export type YouTubeErrorCode =
  | 'YOUTUBE_DAILY_QUOTA_EXCEEDED'
  | 'YOUTUBE_RATE_LIMITED'
  | 'YOUTUBE_BACKEND_ERROR'
  | 'YOUTUBE_API_ERROR'

export const YOUTUBE_DAILY_QUOTA_MESSAGE =
  'Les recherches YouTube sont temporairement indisponibles car la limite quotidienne a ete atteinte. Reessayez apres la reinitialisation du quota.'

export const YOUTUBE_RATE_LIMIT_MESSAGE =
  'Les recherches YouTube sont temporairement ralenties. Reessayez dans quelques instants.'

export const YOUTUBE_BACKEND_ERROR_MESSAGE =
  'YouTube est temporairement indisponible. Reessayez dans quelques instants.'

export const YOUTUBE_GENERIC_ERROR_MESSAGE =
  'La recherche YouTube a echoue. Reessayez dans quelques instants.'

export class YouTubeApiError extends Error {
  code: YouTubeErrorCode
  status: number
  reason?: string
  endpoint?: string
  httpStatus?: number
  retryable: boolean

  constructor(
    code: YouTubeErrorCode,
    message: string,
    options: {
      status?: number
      reason?: string
      endpoint?: string
      httpStatus?: number
      retryable?: boolean
    } = {}
  ) {
    super(message)
    this.name = 'YouTubeApiError'
    this.code = code
    this.status = options.status ?? 500
    this.reason = options.reason
    this.endpoint = options.endpoint
    this.httpStatus = options.httpStatus
    this.retryable = options.retryable ?? false
  }
}

export function sanitizeGoogleMessage(message: string) {
  return message
    .replace(/AIza[0-9A-Za-z_-]+/g, '[redacted_api_key]')
    .replace(/projects?\/[0-9A-Za-z_-]+/gi, 'project/[redacted]')
    .replace(/([?&]key=)[^&\s]+/g, '$1[redacted]')
}

function extractGoogleReason(payload: any): string | undefined {
  const errors = payload?.error?.errors
  if (Array.isArray(errors)) {
    const reason = errors.find((item: any) => typeof item?.reason === 'string')?.reason
    if (reason) return reason
  }
  return typeof payload?.error?.status === 'string' ? payload.error.status : undefined
}

export function classifyYouTubeError(input: {
  payload?: any
  status?: number
  endpoint?: string
  fallbackMessage?: string
}) {
  const reason = extractGoogleReason(input.payload)
  const rawMessage =
    typeof input.payload?.error?.message === 'string'
      ? input.payload.error.message
      : input.fallbackMessage || 'Erreur YouTube.'
  const message = sanitizeGoogleMessage(rawMessage)
  const endpoint = input.endpoint
  const httpStatus = input.status

  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
    return new YouTubeApiError('YOUTUBE_DAILY_QUOTA_EXCEEDED', YOUTUBE_DAILY_QUOTA_MESSAGE, {
      status: 429,
      reason,
      endpoint,
      httpStatus,
      retryable: true,
    })
  }

  if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
    return new YouTubeApiError('YOUTUBE_RATE_LIMITED', YOUTUBE_RATE_LIMIT_MESSAGE, {
      status: 429,
      reason,
      endpoint,
      httpStatus,
      retryable: true,
    })
  }

  if (reason === 'backendError' || input.status === 500 || input.status === 503) {
    return new YouTubeApiError('YOUTUBE_BACKEND_ERROR', YOUTUBE_BACKEND_ERROR_MESSAGE, {
      status: 503,
      reason,
      endpoint,
      httpStatus,
      retryable: true,
    })
  }

  return new YouTubeApiError('YOUTUBE_API_ERROR', message, {
    status: input.status && input.status >= 400 ? input.status : 500,
    reason,
    endpoint,
    httpStatus,
    retryable: false,
  })
}

export function getSafeYouTubeLog(error: unknown) {
  if (error instanceof YouTubeApiError) {
    return {
      code: error.code,
      reason: error.reason,
      endpoint: error.endpoint,
      httpStatus: error.httpStatus,
      retryable: error.retryable,
    }
  }

  return {
    code: 'YOUTUBE_UNKNOWN_ERROR',
    message: error instanceof Error ? sanitizeGoogleMessage(error.message) : 'Erreur inconnue YouTube.',
  }
}

export function buildYouTubeErrorResponse(error: unknown) {
  if (error instanceof YouTubeApiError) {
    const message =
      error.code === 'YOUTUBE_API_ERROR' ? YOUTUBE_GENERIC_ERROR_MESSAGE : error.message

    return {
      body: {
        error: error.code,
        message,
        retryable: error.retryable,
        source: 'youtube_error',
      },
      status: error.status,
    }
  }

  return {
    body: {
      error: 'YOUTUBE_API_ERROR',
      message: YOUTUBE_GENERIC_ERROR_MESSAGE,
      retryable: false,
      source: 'youtube_error',
    },
    status: 500,
  }
}
