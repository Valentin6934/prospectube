'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppLoader from '@/components/AppLoader'
import MainAppNav from '@/components/MainAppNav'
import SubscriptionButton from '@/components/SubscriptionButton'
import Toast, { useToast } from '@/components/Toast'
import { isPro } from '@/lib/plan'
import { shouldDisableGmailDrafts } from '@/lib/gmailStatus'

type GmailStatus = {
  connected: boolean
  status: 'connected' | 'expired' | 'disconnected' | 'unavailable'
  state: 'connected' | 'expired' | 'disconnected' | 'unavailable'
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
  accessAllowed?: boolean
  upgradeRequired?: boolean
}

const OAUTH_MESSAGES: Record<string, string> = {
  OAUTH_NOT_CONFIGURED: 'La connexion Gmail est temporairement indisponible.',
  OAUTH_REDIRECT_MISMATCH: 'La connexion Gmail est temporairement indisponible.',
  OAUTH_ACCESS_DENIED: 'L’autorisation Gmail a été annulée.',
  OAUTH_APP_UNVERIFIED: 'La connexion Gmail n’est pas encore disponible pour tous les comptes Google.',
  OAUTH_ACCOUNT_NOT_ALLOWED: 'Ce compte Google n’est pas autorisé à utiliser la connexion Gmail pour le moment.',
  GMAIL_TOKEN_EXPIRED: 'Votre connexion Gmail a expiré. Reconnectez votre compte pour continuer.',
  GMAIL_SCOPE_INSUFFICIENT: 'L’autorisation Gmail ne permet pas de créer des brouillons. Reconnectez Gmail.',
  GMAIL_INTERNAL_ERROR: 'La connexion Gmail a échoué. Réessayez dans quelques instants.',
  FREE_CAMPAIGN_COMPLETED: 'Votre campagne d’essai est terminée. Passez au Plan Pro pour reconnecter Gmail.',
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [gmail, setGmail] = useState<GmailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const { toast, showToast } = useToast()
  const plan = (session?.user as any)?.plan || 'Gratuit'
  const proUser = isPro(plan)
  const userEmail = session?.user?.email || ''
  const userName = session?.user?.name || userEmail.split('@')[0] || 'Utilisateur'
  const gmailNeedsReconnect = shouldDisableGmailDrafts(gmail) && gmail?.state === 'expired'
  const gmailStatusLabel = gmailNeedsReconnect ? 'Connexion expirée' : gmail?.connected ? 'Connecté' : 'Non connecté'
  const gmailStatusColor = gmailNeedsReconnect ? '#f59e0b' : gmail?.connected ? '#22c55e' : '#A89FCC'
  const gmailStatusBg = gmailNeedsReconnect ? 'rgba(245,158,11,0.12)' : gmail?.connected ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('gmail')
    if (!result) return

    if (result === 'connected') showToast('Gmail connecté avec succès.')
    else showToast(OAUTH_MESSAGES[result] || 'La connexion Gmail a échoué. Réessayez.', result === 'OAUTH_ACCESS_DENIED' ? 'info' : 'error')

    window.history.replaceState({}, '', '/settings')
  }, [showToast])

  useEffect(() => {
    if (status !== 'authenticated') return
    loadGmailStatus()
  }, [status, proUser])

  const loadGmailStatus = async () => {
    try {
      const response = await fetch('/api/gmail', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Impossible de vérifier Gmail.')
      setGmail(data)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Impossible de vérifier Gmail.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const disconnectGmail = async () => {
    if (!window.confirm('Déconnecter Gmail de ProspectTube ?')) return
    setDisconnecting(true)
    try {
      const response = await fetch('/api/gmail', { method: 'DELETE', cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Impossible de déconnecter Gmail.')
      setGmail(data.gmail || {
        connected: false,
        status: 'disconnected',
        state: 'disconnected',
        canUseGmail: false,
        email: null,
        hasRefreshToken: false,
        expiryDate: null,
        updatedAt: null,
        sendMode: 'draft',
      })
      showToast('Gmail déconnecté.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Impossible de déconnecter Gmail.', 'error')
    } finally {
      setDisconnecting(false)
    }
  }

  if (status === 'loading' || loading) return <AppLoader text="Chargement des paramètres..." />

  return (
    <main style={{ minHeight: '100vh', background: '#0A0812' }}>
      <MainAppNav plan={plan} active="settings" />

      <div style={{ width: 'min(860px, calc(100% - 2rem))', margin: '0 auto', padding: '2.5rem 0 4rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ color: '#8b78dd', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.35rem' }}>Compte</div>
          <h1 className="font-display" style={{ margin: 0, fontSize: '1.75rem' }}>Paramètres</h1>
          <p style={{ color: '#9087ad', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Gérez votre compte ProspectTube, votre plan et l’état de vos intégrations.
          </p>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <section className="card" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Informations du compte</h2>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.86rem' }}>
                <span style={{ color: '#8F86AA' }}>Nom</span>
                <strong style={{ color: '#F0EDF8' }}>{userName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.86rem' }}>
                <span style={{ color: '#8F86AA' }}>Email</span>
                <strong style={{ color: '#F0EDF8' }}>{userEmail}</strong>
              </div>
            </div>
          </section>

          <section className="card" style={{ padding: '1.25rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>Plan actuel</h2>
              <p style={{ margin: 0, color: '#A89FCC', fontSize: '0.84rem' }}>
                {proUser ? 'Votre abonnement Pro est actif.' : 'Vous utilisez le plan Gratuit avec les limites de la V1.'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#F0EDF8', fontWeight: 900, fontSize: '1.1rem' }}>Plan {plan}</div>
              <SubscriptionButton plan={plan} />
            </div>
          </section>

          <section className="card" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>Intégration Gmail</h2>
                <p style={{ margin: 0, color: '#A89FCC', fontSize: '0.84rem', lineHeight: 1.55 }}>
                  Gmail est nécessaire pour créer les brouillons depuis vos campagnes.
                </p>
              </div>
              <span style={{ color: gmailStatusColor, background: gmailStatusBg, border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '0.32rem 0.7rem', fontSize: '0.78rem', fontWeight: 800 }}>
                {gmailStatusLabel}
              </span>
            </div>

            {gmail?.email && (
              <div style={{ color: '#80769f', fontSize: '0.78rem', marginTop: '0.75rem' }}>
                Compte Gmail : {gmail.email}
              </div>
            )}

            {gmailNeedsReconnect && (
              <div style={{ marginTop: '1rem', border: '1px solid rgba(245,158,11,0.24)', background: 'rgba(245,158,11,0.08)', borderRadius: '10px', padding: '0.85rem', color: '#fbbf24', fontSize: '0.84rem', lineHeight: 1.55 }}>
                {gmail?.message || 'Votre connexion Gmail a expiré. Reconnectez votre compte pour continuer.'}
              </div>
            )}

            {!gmail?.connected && !gmailNeedsReconnect && (
              <p style={{ margin: '1rem 0 0', color: '#A89FCC', fontSize: '0.84rem', lineHeight: 1.55 }}>
                Connectez Gmail pour créer des brouillons depuis vos campagnes, sans quitter ProspectTube.
              </p>
            )}

            {gmail?.accessAllowed === false && (
              <div style={{ marginTop: '1rem', border: '1px solid rgba(167,139,250,0.25)', background: 'rgba(83,58,183,0.1)', borderRadius: '10px', padding: '0.85rem', color: '#C4BCDF', fontSize: '0.84rem', lineHeight: 1.55 }}>
                Votre campagne d’essai est terminée. Votre connexion reste consultable, mais une nouvelle utilisation Gmail nécessite le Plan Pro.
              </div>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                <button onClick={() => window.location.assign('/api/gmail/connect?returnTo=/settings')} disabled={gmail?.accessAllowed === false} className="btn-primary" style={{ padding: '0.65rem 1rem', fontSize: '0.84rem', opacity: gmail?.accessAllowed === false ? 0.55 : 1 }}>
                  {gmail?.connected ? 'Reconnecter Gmail' : gmailNeedsReconnect ? 'Reconnecter Gmail' : 'Connecter Gmail'}
                </button>
                {gmail?.accessAllowed === false && <SubscriptionButton plan={plan} label="Passer au Plan Pro" />}
                {(gmail?.connected || gmailNeedsReconnect || gmail?.email) && (
                  <button onClick={disconnectGmail} disabled={disconnecting} className="btn btn-secondary">
                    {disconnecting ? 'Déconnexion...' : 'Déconnecter Gmail'}
                  </button>
                )}
            </div>
          </section>
        </div>
      </div>

      <Toast toast={toast} />
    </main>
  )
}
