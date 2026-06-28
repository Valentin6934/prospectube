'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppLoader from '@/components/AppLoader'
import Toast, { useToast } from '@/components/Toast'

type GmailStatus = {
  connected: boolean
  email: string | null
  hasRefreshToken: boolean
  expiryDate: string | null
  sendMode: 'draft' | 'send'
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [gmail, setGmail] = useState<GmailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const { toast, showToast } = useToast()
  const plan = (session?.user as any)?.plan || 'Gratuit'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('gmail')
    if (!result) return

    if (result === 'connected') showToast('Gmail connecté avec succès.')
    else if (result === 'cancelled') showToast('Autorisation Gmail annulée.', 'info')
    else showToast('La connexion Gmail a échoué. Réessayez.', 'error')

    window.history.replaceState({}, '', '/settings')
  }, [showToast])

  useEffect(() => {
    if (status !== 'authenticated') return

    fetch('/api/gmail')
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Impossible de vérifier Gmail.')
        setGmail(data)
      })
      .catch(error => showToast(error.message, 'error'))
      .finally(() => setLoading(false))
  }, [status, showToast])

  const connectGmail = async () => {
    window.location.assign('/api/gmail/connect')
  }

  const disconnectGmail = async () => {
    setDisconnecting(true)
    const response = await fetch('/api/gmail', { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    setDisconnecting(false)

    if (!response.ok) {
      showToast(data.error || 'Impossible de déconnecter Gmail.', 'error')
      return
    }

    setGmail(current => current ? { ...current, connected: false, email: null } : null)
    showToast('Gmail déconnecté.')
  }

  if (status === 'loading' || loading) return <AppLoader text="Chargement des paramètres..." />

  return (
    <main style={{ minHeight: '100vh', background: '#0A0812' }}>
      <nav className="app-nav" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,8,18,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(83,58,183,0.2)', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <Link href="/dashboard/home" style={{ textDecoration: 'none' }}>
          <div className="font-display" style={{ fontWeight: 800, fontSize: '1.2rem', color: '#F0EDF8' }}>
            Prospect<span className="grad-text">Tube</span>
          </div>
        </Link>
        <div className="app-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard/home" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>🏠 Accueil</Link>
          <Link href="/dashboard" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>Nouvelle recherche</Link>
          <Link href="/favorites" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>⭐ Favoris</Link>
          <Link href="/history" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>📁 Historique</Link>
          <Link href="/campaigns" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>📧 Campagnes</Link>
          <Link href="/settings" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.85rem' }}>⚙ Paramètres</Link>
          <div style={{ background: 'rgba(83,58,183,0.2)', border: '1px solid rgba(83,58,183,0.4)', color: '#a78bfa', padding: '0.2rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 500 }}>Plan {plan}</div>
          <button onClick={() => signOut({ callbackUrl: '/' })} className="btn btn-secondary">Déconnexion</button>
        </div>
      </nav>

      <div style={{ width: 'min(760px, calc(100% - 2rem))', margin: '0 auto', padding: '2.5rem 0 4rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ color: '#8b78dd', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.35rem' }}>Intégrations</div>
          <h1 className="font-display" style={{ margin: 0, fontSize: '1.65rem' }}>Paramètres</h1>
          <p style={{ color: '#9087ad', fontSize: '0.86rem', lineHeight: 1.6 }}>
            Connectez votre compte Gmail pour créer des brouillons ou envoyer les messages de campagne.
          </p>
        </div>

        <section className="card" style={{ padding: '1.25rem', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'start' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'rgba(234,67,53,0.12)', display: 'grid', placeItems: 'center', fontSize: '1.1rem' }}>✉</div>
              <div>
                <h2 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>Connexion Gmail</h2>
                <div style={{ color: gmail?.connected ? '#22c55e' : '#A89FCC', fontSize: '0.82rem', fontWeight: 700 }}>
                  {gmail?.connected ? '✅ Connecté' : 'Non connecté'}
                </div>
                {gmail?.connected && gmail.email && (
                  <div style={{ color: '#80769f', fontSize: '0.76rem', marginTop: '0.3rem' }}>{gmail.email}</div>
                )}
              </div>
            </div>

            {gmail?.connected ? (
              <button onClick={disconnectGmail} disabled={disconnecting} className="btn btn-danger">
                {disconnecting ? <span className="button-loader"><span className="app-spinner" /> Déconnexion...</span> : 'Déconnecter Gmail'}
              </button>
            ) : (
              <button onClick={connectGmail} className="btn-primary" style={{ padding: '0.65rem 1rem' }}>
                Connecter Gmail
              </button>
            )}
          </div>

          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'grid', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.8rem' }}>
              <span style={{ color: '#80769f' }}>Mode d’envoi</span>
              <strong style={{ color: gmail?.sendMode === 'send' ? '#f59e0b' : '#38bdf8' }}>
                {gmail?.sendMode === 'send' ? 'Envoi direct' : 'Création de brouillons'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.8rem' }}>
              <span style={{ color: '#80769f' }}>Renouvellement automatique</span>
              <strong style={{ color: gmail?.hasRefreshToken ? '#22c55e' : '#A89FCC' }}>
                {gmail?.hasRefreshToken ? 'Actif' : 'En attente de connexion'}
              </strong>
            </div>
          </div>
        </section>

        <div style={{ marginTop: '1rem', border: '1px solid rgba(56,189,248,0.18)', borderRadius: '8px', background: 'rgba(56,189,248,0.06)', padding: '0.9rem', color: '#9cb8c8', fontSize: '0.78rem', lineHeight: 1.6 }}>
          ProspectTube utilise uniquement les autorisations Gmail nécessaires à la création et à l’envoi de vos messages. Aucun accès à vos emails reçus n’est demandé.
        </div>
      </div>

      <Toast toast={toast} />
    </main>
  )
}
