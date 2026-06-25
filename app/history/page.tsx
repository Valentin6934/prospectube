'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type HistoryItem = {
  id: string
  niche: string
  language: string
  subsMin: string
  subsMax: string
  resultCount: number
  createdAt: string
}

type Channel = {
  id?: string
  name?: string
  subs?: string
  subsNum?: number
  score?: number
  scoreLabel?: string
  scoreReason?: string
  email?: string | null
  instagram?: string | null
  tiktok?: string | null
  twitch?: string | null
  website?: string | null
  channelUrl?: string | null
  desc?: string
  avatar?: string
  color?: string
  totalViews?: number
  totalViewsFormatted?: string
  videoCount?: number
  videoCountFormatted?: string
  createdAt?: string | null
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

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function getScoreStyles(score: number) {
  if (score >= 80) return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
  if (score >= 60) return { background: 'rgba(234,179,8,0.15)', color: '#eab308' }
  return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
}

function normalizeResults(results: unknown): Channel[] {
  if (Array.isArray(results)) return results

  if (typeof results === 'string') {
    try {
      const parsed = JSON.parse(results)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
}

export default function HistoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSearch, setSelectedSearch] = useState<HistoryItem | null>(null)
  const [selectedResults, setSelectedResults] = useState<Channel[]>([])
  const [resultsLoadingId, setResultsLoadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [favoriteLoadingId, setFavoriteLoadingId] = useState<string | null>(null)
  const [resultsError, setResultsError] = useState('')
  const plan = (session?.user as any)?.plan || 'Gratuit'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return

    Promise.all([
      fetch('/api/history')
        .then(res => res.ok ? res.json() : { searches: [] })
        .catch(() => ({ searches: [] })),
      fetch('/api/favorites')
        .then(res => res.ok ? res.json() : { favorites: [] })
        .catch(() => ({ favorites: [] })),
    ])
      .then(([historyData, favoritesData]) => {
        setHistory(historyData.searches || [])
        setFavoriteIds((favoritesData.favorites || []).map((favorite: any) => favorite.channelId).filter(Boolean))
      })
      .finally(() => setLoading(false))
  }, [status])

  const viewResults = async (item: HistoryItem) => {
    setResultsLoadingId(item.id)
    setResultsError('')

    const res = await fetch(`/api/history/${item.id}`)
    const data = await res.json().catch(() => ({}))
    console.log('Historique JSON reçu:', data)
    setResultsLoadingId(null)

    if (!res.ok) {
      setSelectedSearch(item)
      setSelectedResults([])
      setResultsError(data.error || 'Impossible de charger les résultats sauvegardés.')
      return
    }

    const results = normalizeResults(data.search?.results)
    setSelectedSearch(item)
    setSelectedResults(results)
    window.setTimeout(() => {
      document.getElementById('saved-history-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
    setResultsError(results.length === 0 ? 'Aucun résultat sauvegardé pour cette recherche.' : '')
  }

  const deleteSearch = async (item: HistoryItem) => {
    setDeletingId(item.id)

    const res = await fetch(`/api/history/${item.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setDeletingId(null)

    if (!res.ok) return alert(data.error || 'Impossible de supprimer cette recherche.')

    setHistory(current => current.filter(search => search.id !== item.id))
    if (selectedSearch?.id === item.id) {
      setSelectedSearch(null)
      setSelectedResults([])
      setResultsError('')
    }
  }

  const addFavorite = async (channel: Channel) => {
    const channelId = channel.id
    if (!channelId || favoriteIds.includes(channelId)) return

    setFavoriteLoadingId(channelId)

    const res = await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(channel),
    })
    const data = await res.json().catch(() => ({}))
    setFavoriteLoadingId(null)

    if (!res.ok) return alert(data.error || "Impossible d'ajouter ce favori.")

    const savedChannelId = data.favorite?.channelId || channelId
    setFavoriteIds(current => current.includes(savedChannelId) ? current : [...current, savedChannelId])
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
          <Link href="/favorites" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>
            ⭐ Mes favoris
          </Link>
          <Link href="/history" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.85rem' }}>
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

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h2 className="font-display" style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '1rem' }}>
          Historique des recherches
        </h2>

        {history.length === 0 ? (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#A89FCC' }}>
            Aucune recherche sauvegardée pour le moment.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {history.map(item => (
              <div key={item.id} className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                    {item.niche || 'Niche inconnue'} · {item.language || 'Langue inconnue'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#A89FCC' }}>
                    {item.subsMin} à {item.subsMax} abonnés · {item.resultCount} résultat{item.resultCount !== 1 ? 's' : ''} · {formatDate(item.createdAt)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button onClick={() => viewResults(item)} disabled={resultsLoadingId === item.id} style={{ background: 'rgba(83,58,183,0.25)', border: '1px solid rgba(83,58,183,0.35)', color: '#a78bfa', padding: '0.45rem 0.8rem', borderRadius: '8px', cursor: resultsLoadingId === item.id ? 'default' : 'pointer', fontSize: '0.8rem' }}>
                    {resultsLoadingId === item.id ? 'Chargement...' : 'Voir les résultats'}
                  </button>
                  <button onClick={() => deleteSearch(item)} disabled={deletingId === item.id} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '0.45rem 0.8rem', borderRadius: '8px', cursor: deletingId === item.id ? 'default' : 'pointer', fontSize: '0.8rem' }}>
                    {deletingId === item.id ? 'Suppression...' : 'Supprimer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedSearch && (
          <div id="saved-history-results">
            <h3 className="font-display" style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '1rem' }}>
              Résultats sauvegardés · {selectedSearch.niche} · {selectedSearch.language}
            </h3>

            {resultsError ? (
              <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: '#A89FCC' }}>
                {resultsError}
              </div>
            ) : (
              selectedResults.map((ch, index) => {
                const score = ch.score || 0
                const color = ch.color || '#533AB7'
                const avatar = ch.avatar || (ch.name || 'YT').slice(0, 2).toUpperCase()
                const year = getCreatedYear(ch.createdAt)
                const channelId = ch.id
                const isFavorite = Boolean(channelId && favoriteIds.includes(channelId))

                return (
                  <div key={channelId || `${ch.name}-${index}`} className="card" style={{ padding: '1.25rem', marginBottom: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: `${color}33`, border: `2px solid ${color}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color, flexShrink: 0 }}>
                      {avatar}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.2rem' }}>{ch.name || 'Chaîne inconnue'}</div>

                      <div style={{ display: 'inline-block', marginBottom: '0.35rem', padding: '0.2rem 0.6rem', borderRadius: '999px', ...getScoreStyles(score), fontSize: '0.75rem', fontWeight: 600 }}>
                        ⭐ {ch.scoreLabel || 'Potentiel faible'} · {score}/100
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#C4BCDF', marginBottom: '0.25rem' }}>
                        {ch.scoreReason || "Faible potentiel ou peu d'informations disponibles"}
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#A89FCC', marginBottom: '0.6rem' }}>
                        {ch.subs || formatCompactNumber(ch.subsNum || 0)} abonnés · {ch.totalViewsFormatted || formatCompactNumber(ch.totalViews || 0)} vues · {ch.videoCountFormatted || formatCompactNumber(ch.videoCount || 0)} vidéos{year ? ` · créée en ${year}` : ''}
                      </div>

                      {ch.desc && (
                        <div style={{ fontSize: '0.82rem', color: '#A89FCC', marginBottom: '0.6rem' }}>{ch.desc}</div>
                      )}

                      <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.8rem' }}>
                        {ch.email ? <a href={`mailto:${ch.email}`} style={{ color: '#22c55e', textDecoration: 'none' }}>📧 {ch.email}</a> : <div style={{ color: '#6B5F96' }}>📭 Email non trouvé</div>}
                        {ch.channelUrl && <a href={ch.channelUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'none' }}>🎥 Voir la chaîne YouTube</a>}
                        {ch.instagram ? <a href={ch.instagram} target="_blank" rel="noopener noreferrer" style={{ color: '#e879f9', textDecoration: 'none' }}>📷 Instagram</a> : <div style={{ color: '#6B5F96' }}>📷 Instagram non trouvé</div>}
                        {ch.tiktok ? <a href={ch.tiktok} target="_blank" rel="noopener noreferrer" style={{ color: '#f472b6', textDecoration: 'none' }}>🎵 TikTok</a> : <div style={{ color: '#6B5F96' }}>🎵 TikTok non trouvé</div>}
                        {ch.twitch ? <a href={ch.twitch} target="_blank" rel="noopener noreferrer" style={{ color: '#9146FF', textDecoration: 'none' }}>🎮 Twitch</a> : <div style={{ color: '#6B5F96' }}>🎮 Twitch non trouvé</div>}
                        {ch.website ? <a href={ch.website} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>🌐 Site web</a> : <div style={{ color: '#6B5F96' }}>🌐 Site web non trouvé</div>}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      <button
                        onClick={() => addFavorite(ch)}
                        disabled={!channelId || isFavorite || favoriteLoadingId === channelId}
                        style={{ background: isFavorite ? 'rgba(234,179,8,0.16)' : 'rgba(83,58,183,0.15)', color: isFavorite ? '#eab308' : '#A89FCC', border: '1px solid rgba(83,58,183,0.35)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.82rem', cursor: !channelId || isFavorite ? 'default' : 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
                      >
                        {isFavorite ? '⭐ Favori ajouté' : favoriteLoadingId === channelId ? 'Ajout...' : '☆ Ajouter aux favoris'}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
