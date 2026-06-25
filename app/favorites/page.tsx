'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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

function formatCompactNumber(n: number): string {
  if (n >= 1000000000) return `${(n / 1000000000).toFixed(1).replace('.0', '')}B`
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`
  return String(n || 0)
}

function getCreatedYear(createdAt: string | null | undefined): string {
  if (!createdAt) return ''
  const year = new Date(createdAt).getFullYear()
  return Number.isFinite(year) ? String(year) : ''
}

function getScoreStyles(score: number) {
  if (score >= 80) return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
  if (score >= 60) return { background: 'rgba(234,179,8,0.15)', color: '#eab308' }
  return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
}

export default function FavoritesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const plan = (session?.user as any)?.plan || 'Gratuit'

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

  const deleteFavorite = async (favoriteId: string) => {
    setDeletingId(favoriteId)

    const res = await fetch(`/api/favorites/${favoriteId}`, { method: 'DELETE' })
    setDeletingId(null)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return alert(data.error || 'Impossible de supprimer ce favori.')
    }

    setFavorites(current => current.filter(favorite => favorite.id !== favoriteId))
  }

  if (status === 'loading' || loading) return (
    <div style={{ minHeight: '100vh', background: '#0A0812', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#A89FCC' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0A0812' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,8,18,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(83,58,183,0.2)', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div className="font-display" style={{ fontWeight: 800, fontSize: '1.2rem', color: '#F0EDF8' }}>
            Prospect<span className="grad-text">Tube</span>
          </div>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>
            Retour dashboard
          </Link>
          <Link href="/favorites" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.85rem' }}>
            ⭐ Mes favoris
          </Link>
          <Link href="/history" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>
            📁 Historique
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
          favorites.map(favorite => {
            const score = favorite.score || 0
            const year = getCreatedYear(favorite.channelCreatedAt)

            return (
              <div key={favorite.id} className="card" style={{ padding: '1.25rem', marginBottom: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: `${favorite.color || '#533AB7'}33`, border: `2px solid ${favorite.color || '#533AB7'}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: favorite.color || '#533AB7', flexShrink: 0 }}>
                  {favorite.avatar || favorite.name.slice(0, 2).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.2rem' }}>{favorite.name}</div>

                  <div style={{ display: 'inline-block', marginBottom: '0.35rem', padding: '0.2rem 0.6rem', borderRadius: '999px', ...getScoreStyles(score), fontSize: '0.75rem', fontWeight: 600 }}>
                    ⭐ {favorite.scoreLabel || 'Potentiel faible'} · {score}/100
                  </div>

                  <div style={{ fontSize: '0.82rem', color: '#C4BCDF', marginBottom: '0.25rem' }}>
                    {favorite.scoreReason || "Faible potentiel ou peu d'informations disponibles"}
                  </div>

                  <div style={{ fontSize: '0.82rem', color: '#A89FCC', marginBottom: '0.6rem' }}>
                    {favorite.subs || formatCompactNumber(favorite.subsNum || 0)} abonnés · {formatCompactNumber(favorite.totalViews || 0)} vues · {formatCompactNumber(favorite.videoCount || 0)} vidéos{year ? ` · créée en ${year}` : ''}
                  </div>

                  {favorite.desc && (
                    <div style={{ fontSize: '0.82rem', color: '#A89FCC', marginBottom: '0.6rem' }}>{favorite.desc}</div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    {[favorite.niche, favorite.lang].filter(Boolean).map(tag => (
                      <span key={tag} style={{ fontSize: '0.75rem', padding: '0.15rem 0.6rem', borderRadius: '20px', background: 'rgba(83,58,183,0.15)', border: '1px solid rgba(83,58,183,0.3)', color: '#a78bfa' }}>{tag}</span>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.8rem' }}>
                    {favorite.email ? (
                      <a href={`mailto:${favorite.email}`} style={{ color: '#22c55e', textDecoration: 'none' }}>📧 {favorite.email}</a>
                    ) : (
                      <div style={{ color: '#6B5F96' }}>📭 Email non trouvé</div>
                    )}

                    {favorite.channelUrl && <a href={favorite.channelUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'none' }}>🎥 Voir la chaîne YouTube</a>}
                    {favorite.instagram ? <a href={favorite.instagram} target="_blank" rel="noopener noreferrer" style={{ color: '#e879f9', textDecoration: 'none' }}>📷 Instagram</a> : <div style={{ color: '#6B5F96' }}>📷 Instagram non trouvé</div>}
                    {favorite.tiktok ? <a href={favorite.tiktok} target="_blank" rel="noopener noreferrer" style={{ color: '#f472b6', textDecoration: 'none' }}>🎵 TikTok</a> : <div style={{ color: '#6B5F96' }}>🎵 TikTok non trouvé</div>}
                    {favorite.twitch ? <a href={favorite.twitch} target="_blank" rel="noopener noreferrer" style={{ color: '#9146FF', textDecoration: 'none' }}>🎮 Twitch</a> : <div style={{ color: '#6B5F96' }}>🎮 Twitch non trouvé</div>}
                    {favorite.website ? <a href={favorite.website} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>🌐 Site web</a> : <div style={{ color: '#6B5F96' }}>🌐 Site web non trouvé</div>}
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  <button onClick={() => deleteFavorite(favorite.id)} disabled={deletingId === favorite.id} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.82rem', cursor: deletingId === favorite.id ? 'default' : 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {deletingId === favorite.id ? 'Suppression...' : 'Supprimer'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
