'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppLoader from '@/components/AppLoader'
import SubscriptionButton from '@/components/SubscriptionButton'
import Toast, { useToast } from '@/components/Toast'
import { isPro } from '@/lib/plan'

type GmailStatus = {
  connected: boolean
  email: string | null
  hasRefreshToken: boolean
  expiryDate: string | null
  sendMode: 'draft' | 'send'
  unavailable?: boolean
  setupRequired?: boolean
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [gmail, setGmail] = useState<GmailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast, showToast } = useToast()
  const plan = (session?.user as any)?.plan || 'Gratuit'
  const proUser = isPro(plan)
  const userEmail = session?.user?.email || ''
  const userName = session?.user?.name || userEmail.split('@')[0] || 'Utilisateur'

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
    if (!proUser) {
      setLoading(false)
      return
    }

    fetch('/api/gmail')
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Impossible de vérifier Gmail.')
        setGmail(data)
      })
      .catch(error => showToast(error.message, 'error'))
      .finally(() => setLoading(false))
  }, [status, proUser, showToast])

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
          <Link href="/dashboard/home" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>Accueil</Link>
          <Link href="/dashboard" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>Nouvelle recherche</Link>
          <Link href="/favorites" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>Favoris</Link>
          <Link href="/history" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>Historique</Link>
          <Link href="/campaigns" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>Campagnes</Link>
          <Link href="/settings" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.85rem' }}>Paramètres</Link>
          <div style={{ background: 'rgba(83,58,183,0.2)', border: '1px solid rgba(83,58,183,0.4)', color: '#a78bfa', padding: '0.2rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 500 }}>Plan {plan}</div>
          <button onClick={() => signOut({ callbackUrl: '/' })} className="btn btn-secondary">Déconnexion</button>
        </div>
      </nav>

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
              <div>
                <h2 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>Intégration Gmail</h2>
                <p style={{ margin: 0, color: '#A89FCC', fontSize: '0.84rem', lineHeight: 1.55 }}>
                  La connexion Gmail se fait maintenant depuis le parcours Campagnes, au moment où elle devient nécessaire.
                </p>
              </div>
              <span style={{ color: gmail?.connected ? '#22c55e' : '#A89FCC', background: gmail?.connected ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '0.32rem 0.7rem', fontSize: '0.78rem', fontWeight: 800 }}>
                {proUser ? (gmail?.connected ? 'Connecté' : 'Non connecté') : 'Disponible en Pro'}
              </span>
            </div>
            {gmail?.connected && gmail.email && (
              <div style={{ color: '#80769f', fontSize: '0.78rem', marginTop: '0.75rem' }}>
                Compte connecté : {gmail.email}
              </div>
            )}
            {!proUser && (
              <div style={{ marginTop: '1rem' }}>
                <SubscriptionButton plan="Gratuit" />
              </div>
            )}
          </section>
        </div>
      </div>

      <Toast toast={toast} />
    </main>
  )
}
