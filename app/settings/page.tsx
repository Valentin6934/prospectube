'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppLoader from '@/components/AppLoader'
import MainAppNav from '@/components/MainAppNav'
import SubscriptionButton from '@/components/SubscriptionButton'
import { isPro } from '@/lib/plan'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const plan = (session?.user as any)?.plan || 'Gratuit'
  const proUser = isPro(plan)
  const userEmail = session?.user?.email || ''
  const userName = session?.user?.name || userEmail.split('@')[0] || 'Utilisateur'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') return <AppLoader text="Chargement des paramètres..." />

  return (
    <main style={{ minHeight: '100vh', background: '#0A0812' }}>
      <MainAppNav plan={plan} active="settings" />

      <div style={{ width: 'min(860px, calc(100% - 2rem))', margin: '0 auto', padding: '2.5rem 0 4rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ color: '#8b78dd', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.35rem' }}>Compte</div>
          <h1 className="font-display" style={{ margin: 0, fontSize: '1.75rem' }}>Paramètres</h1>
          <p style={{ color: '#9087ad', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Gérez votre compte ProspectTube et votre plan.
          </p>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <section className="card" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Informations du compte</h2>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.86rem', flexWrap: 'wrap' }}>
                <span style={{ color: '#8F86AA' }}>Nom</span>
                <strong style={{ color: '#F0EDF8' }}>{userName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.86rem', flexWrap: 'wrap' }}>
                <span style={{ color: '#8F86AA' }}>Email</span>
                <strong style={{ color: '#F0EDF8', overflowWrap: 'anywhere' }}>{userEmail}</strong>
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
            <h2 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>Votre messagerie</h2>
            <p style={{ margin: 0, color: '#A89FCC', fontSize: '0.84rem', lineHeight: 1.6 }}>
              Aucune connexion à votre boîte mail n’est nécessaire. Depuis une campagne, ProspectTube ouvre Gmail ou votre client mail avec le destinataire, le sujet et le message préremplis. Vous relisez et envoyez vous-même.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
