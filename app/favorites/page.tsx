'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProspectCard from '@/components/ProspectCard'

type Favorite = {
  id: string
  channelId: string
  name: string
  subs: string | null
  subsNum: number | null
  niche: string | null
  lang: string | null
  score: number | null
  scoreLabel: string | null
  scoreReason: string | null
  email: string | null
  instagram: string | null
  tiktok: string | null
  twitch: string | null
  website: string | null
  channelUrl: string | null
  aboutUrl: string | null
  desc: string | null
  avatar: string | null
  color: string | null
  thumbnail: string | null
  totalViews: number | null
  videoCount: number | null
  channelCreatedAt: string | null
}

export default function FavoritesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const plan = (session?.user as any)?.plan || 'Gratuit'

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return

    fetch('/api/favorites')
      .then(res => res.ok ? res.json() : { favorites: [] })
      .then(data => setFavorites(data.favorites || []))
      .catch(() => setFavorites([]))
      .finally(() => setLoading(false))
  }, [status])

  useEffect(() => {
    const listener = (event: Event) => {
      showToast((event as CustomEvent<string>).detail)
    }
    window.addEventListener('prospectube-toast', listener)
    return () => window.removeEventListener('prospectube-toast', listener)
  }, [])

  const deleteFavorite = async (favoriteId: string) => {
    setDeletingId(favoriteId)

    const res = await fetch(`/api/favorites/${favoriteId}`, { method: 'DELETE' })
    setDeletingId(null)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return alert(data.error || 'Impossible de supprimer ce favori.')
    }

    setFavorites(current => current.filter(favorite => favorite.id !== favoriteId))
    showToast('✓ Prospect supprimé')
  }

  if (status === 'loading' || loading) return (
    <div style={{ minHeight: '100vh', background: '#0A0812', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#A89FCC' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0A0812' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,8,18,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(83,58,183,0.2)', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <Link href="/dashboard/home" style={{ textDecoration: 'none' }}>
          <div className="font-display" style={{ fontWeight: 800, fontSize: '1.2rem', color: '#F0EDF8' }}>
            Prospect<span className="grad-text">Tube</span>
          </div>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>
            Nouvelle recherche
          </Link>
          <Link href="/favorites" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.85rem' }}>
            ⭐ Mes favoris
          </Link>
          <Link href="/history" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>
            📁 Historique
          </Link>
          <Link href="/campaigns" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>
            📧 Campagnes
          </Link>
          <div style={{ background: 'rgba(83,58,183,0.2)', border: '1px solid rgba(83,58,183,0.4)', color: '#a78bfa', padding: '0.2rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 500 }}>
            Plan {plan}
          </div>
          <button onClick={() => signOut({ callbackUrl: '/' })} style={{ background: 'none', border: '1px solid rgba(83,58,183,0.3)', color: '#A89FCC', padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
            Déconnexion
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
          <h2 className="font-display" style={{ fontWeight: 700, fontSize: '1.2rem' }}>
            ⭐ Mes favoris
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#6B5F96' }}>
            {favorites.length} chaîne{favorites.length !== 1 ? 's' : ''} sauvegardée{favorites.length !== 1 ? 's' : ''}
          </span>
        </div>

        {favorites.length === 0 ? (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#A89FCC' }}>
            Aucun favori pour le moment. Ajoute une chaîne depuis le dashboard.
          </div>
        ) : (
          favorites.map(favorite => (
            <ProspectCard
              key={favorite.id}
              channel={favorite}
              showRemoveButton
              removing={deletingId === favorite.id}
              onRemoveFavorite={() => deleteFavorite(favorite.id)}
            />
          ))
        )}
      </div>
      {toast && (
        <div style={{ position: 'fixed', right: '1rem', bottom: '1rem', zIndex: 1300, background: 'rgba(18,14,31,0.96)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', borderRadius: '10px', padding: '0.7rem 0.95rem', boxShadow: '0 18px 45px rgba(0,0,0,0.35)', fontSize: '0.85rem', fontWeight: 700 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
