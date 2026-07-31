export type GmailConnectionState = 'connected' | 'expired' | 'disconnected' | 'unavailable'

export type GmailStatusResponse = {
  connected: boolean
  status: GmailConnectionState
  state: GmailConnectionState
  canUseGmail: boolean
  email: string | null
  hasRefreshToken: boolean
  expiryDate: string | null
  updatedAt: string | null
  sendMode: 'draft' | 'send'
  message?: string
  reconnectRequired?: boolean
  unavailable?: boolean
  setupRequired?: boolean
}

type AccountStatusInput = {
  email?: string | null
  expiryDate?: Date | string | null
  refreshToken?: string | null
  updatedAt?: Date | string | null
  scope?: string | null
}

export const REQUIRED_GMAIL_DRAFT_SCOPE = 'https://www.googleapis.com/auth/gmail.compose'

export function getSafeGmailErrorMessage(reason?: string | null): string {
  if (reason === 'missing_account') return 'Gmail n’est pas connecté.'
  if (reason === 'missing_refresh_token') return 'Votre connexion Gmail a expiré. Reconnectez votre compte pour continuer.'
  if (reason === 'invalid_refresh_token') return 'Votre connexion Gmail a expiré. Reconnectez votre compte pour continuer.'
  if (reason === 'revoked_access') return 'L’accès Gmail a été révoqué. Reconnectez votre compte pour continuer.'
  if (reason === 'oauth_config') return 'Configuration OAuth Gmail incomplète.'
  if (reason === 'google_temporary') return 'Google est temporairement indisponible. Réessayez dans quelques instants.'
  if (reason === 'scope_missing') return 'L’autorisation Gmail actuelle ne permet pas de créer des brouillons. Reconnectez Gmail.'
  return 'Votre connexion Gmail a expiré. Reconnectez votre compte pour continuer.'
}

function toIso(value?: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

export function buildDisconnectedGmailStatus(sendMode: 'draft' | 'send'): GmailStatusResponse {
  return {
    connected: false,
    status: 'disconnected',
    state: 'disconnected',
    canUseGmail: false,
    email: null,
    hasRefreshToken: false,
    expiryDate: null,
    updatedAt: null,
    sendMode,
  }
}

export function buildGmailStatus(
  account: AccountStatusInput | null,
  sendMode: 'draft' | 'send',
  options: { unavailable?: boolean; setupRequired?: boolean } = {}
): GmailStatusResponse {
  if (!account) {
    return {
      ...buildDisconnectedGmailStatus(sendMode),
      state: options.unavailable ? 'unavailable' : 'disconnected',
      status: options.unavailable ? 'unavailable' : 'disconnected',
      canUseGmail: false,
      unavailable: options.unavailable,
      setupRequired: options.setupRequired,
    }
  }

  const hasRefreshToken = Boolean(account.refreshToken)
  const scopes = typeof account.scope === 'string' ? account.scope.split(/\s+/).filter(Boolean) : []
  const hasDraftScope = scopes.includes(REQUIRED_GMAIL_DRAFT_SCOPE)
  const state: GmailConnectionState = hasRefreshToken && hasDraftScope ? 'connected' : 'expired'

  return {
    connected: state === 'connected',
    status: state,
    state,
    canUseGmail: state === 'connected',
    email: account.email || null,
    hasRefreshToken,
    expiryDate: toIso(account.expiryDate),
    updatedAt: toIso(account.updatedAt),
    sendMode,
    reconnectRequired: state === 'expired',
    message: state === 'expired'
      ? getSafeGmailErrorMessage(hasRefreshToken ? 'scope_missing' : 'missing_refresh_token')
      : undefined,
  }
}

export function shouldDisableGmailDrafts(status?: { connected?: boolean; canUseGmail?: boolean; state?: GmailConnectionState; status?: GmailConnectionState; reconnectRequired?: boolean } | null): boolean {
  if (!status) return true
  if (typeof status.canUseGmail === 'boolean') return !status.canUseGmail
  return !status.connected || status.state === 'expired' || status.status === 'expired' || Boolean(status.reconnectRequired)
}
