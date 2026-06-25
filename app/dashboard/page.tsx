'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const NICHES = ['Gaming', 'Finance & Business', 'Tech & Programmation', 'Fitness & Santé', 'Lifestyle & Vlog', 'Cuisine', 'Musique', 'Éducation', 'Voyage', 'Beauté & Mode']
const LANGS = ['Français', 'Anglais', 'Espagnol', 'Portugais', 'Allemand']
const SUBS_LABELS = ['1K', '10K', '50K', '100K', '500K', '1M', '5M+']

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

function getScoreStyles(scoreColor: string | undefined, score: number) {
  const color = scoreColor || (score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red')

  if (color === 'green') {
    return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
  }

  if (color === 'yellow') {
    return { background: 'rgba(234,179,8,0.15)', color: '#eab308' }
  }

  return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [niche, setNiche] = useState('')
  const [lang, setLang] = useState('Français')
  const [subsMin, setSubsMin] = useState(1)
  const [subsMax, setSubsMax] = useState(4)
  const [editorEmail, setEditorEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  const [canEmail, setCanEmail] = useState(false)
  const [searchesLeft, setSearchesLeft] = useState<number | null>(null)
  const [plan, setPlan] = useState('Gratuit')
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [favoriteLoadingId, setFavoriteLoadingId] = useState<string | null>(null)

  const [emailModal, setEmailModal] = useState<any>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailData, setEmailData] = useState<{ subject: string; body: string } | null>(null)
  const [sendStatus, setSendStatus] = useState('')

  const isPro = plan !== 'Gratuit'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (session?.user) {
      setPlan((session.user as any).plan || 'Gratuit')
      setSearchesLeft((session.user as any).searchesRemaining ?? 5)
    }
  }, [status, session, router])

  useEffect(() => {
    if (status !== 'authenticated') return

    fetch('/api/favorites')
      .then(res => res.ok ? res.json() : { favorites: [] })
      .then(data => {
        const ids = (data.favorites || []).map((favorite: any) => favorite.channelId).filter(Boolean)
        setFavoriteIds(ids)
      })
      .catch(() => setFavoriteIds([]))
  }, [status])

  const copyEmail = async (email: string) => {
    await navigator.clipboard.writeText(email)
    alert('Email copié !')
  }

  const exportCSV = () => {
    if (!isPro) return alert('Export CSV disponible avec le plan Pro.')

    const headers = ['Nom', 'Abonnés', 'Score', 'Email', 'YouTube', 'Instagram', 'TikTok', 'Twitch', 'Site web']
    headers.splice(3, 0, 'Score Label', 'Score Reason', 'Vues totales', 'Nombre de videos', 'Date creation')
    const rows = results.map(ch => [
      ch.name || '',
      ch.subs || '',
      ch.score || '',
      ch.scoreLabel || '',
      ch.scoreReason || '',
      ch.totalViews || '',
      ch.videoCount || '',
      ch.createdAt || '',
      ch.email || '',
      ch.channelUrl || '',
      ch.instagram || '',
      ch.tiktok || '',
      ch.twitch || '',
      ch.website || '',
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'prospectube-results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSearch = async () => {
    if (!niche) return alert('Choisis une niche !')
    if (!editorEmail) return alert('Entre ton email de contact !')
    setLoading(true)
    setSearched(false)

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche, lang, subsMin: String(subsMin), subsMax: String(subsMax) }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      if (data.upgrade) return alert('Quota épuisé ! Passe au plan Pro.')
      return alert(data.error)
    }

    setResults(data.results)
    setCanEmail(data.canGenerateEmail)
    setSearchesLeft(data.searchesRemaining)
    setPlan(data.plan)
    setSearched(true)
  }

  const generateEmail = async (channel: any) => {
    if (!canEmail) return alert('Le plan Pro est requis pour générer des messages IA.')

    setEmailModal(channel)
    setEmailLoading(true)
    setEmailData(null)
    setSendStatus('')

    const res = await fetch('/api/generate-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, editorEmail }),
    })

    const data = await res.json()
    setEmailLoading(false)

    if (!res.ok) {
      if (data.upgrade) return alert('Plan Pro requis pour les messages IA.')
      return alert(data.error)
    }

    setEmailData(data)
  }

  const addFavorite = async (channel: any) => {
    if (!channel?.id || favoriteIds.includes(channel.id)) return

    setFavoriteLoadingId(channel.id)

    const res = await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(channel),
    })

    const data = await res.json()
    setFavoriteLoadingId(null)

    if (!res.ok) return alert(data.error || "Impossible d'ajouter ce favori.")

    const channelId = data.favorite?.channelId || channel.id
    setFavoriteIds(current => current.includes(channelId) ? current : [...current, channelId])
  }

  if (status === 'loading') return (
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
          <Link href="/favorites" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>
            ⭐ Mes favoris
          </Link>
          <div style={{ background: 'rgba(83,58,183,0.2)', border: '1px solid rgba(83,58,183,0.4)', color: '#a78bfa', padding: '0.2rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 500 }}>
            Plan {plan}
          </div>
          {searchesLeft !== null && (
            <div style={{ fontSize: '0.8rem', color: '#A89FCC' }}>
              {searchesLeft} recherche{searchesLeft !== 1 ? 's' : ''} restante{searchesLeft !== 1 ? 's' : ''}
            </div>
          )}
          <button onClick={() => signOut({ callbackUrl: '/' })} style={{ background: 'none', border: '1px solid rgba(83,58,183,0.3)', color: '#A89FCC', padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
            Déconnexion
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {plan === 'Gratuit' && (
          <div style={{ background: 'rgba(83,58,183,0.15)', border: '1px solid rgba(83,58,183,0.4)', borderRadius: '12px', padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <p style={{ color: '#a78bfa', fontSize: '0.9rem' }}>🔒 Passe au plan Pro pour débloquer Instagram, TikTok, Twitch, site web, messages IA, export CSV et plus de résultats</p>
            <Link href="/#pricing">
              <button className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>Voir les plans →</button>
            </Link>
          </div>
        )}

        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 className="font-display" style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
            🔍 Rechercher des chaînes YouTube
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#A89FCC', marginBottom: '0.4rem' }}>Niche *</label>
              <select value={niche} onChange={e => setNiche(e.target.value)}>
                <option value="">Choisir une niche...</option>
                {NICHES.map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#A89FCC', marginBottom: '0.4rem' }}>Langue</label>
              <select value={lang} onChange={e => setLang(e.target.value)}>
                {LANGS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#A89FCC', marginBottom: '0.6rem' }}>
              Abonnés : <strong style={{ color: '#F0EDF8' }}>{SUBS_LABELS[subsMin]}</strong> → <strong style={{ color: '#F0EDF8' }}>{SUBS_LABELS[subsMax]}</strong>
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input type="range" min={0} max={6} value={subsMin} onChange={e => setSubsMin(Math.min(+e.target.value, subsMax))} style={{ flex: 1, accentColor: '#533AB7' }} />
              <input type="range" min={0} max={6} value={subsMax} onChange={e => setSubsMax(Math.max(+e.target.value, subsMin))} style={{ flex: 1, accentColor: '#533AB7' }} />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#A89FCC', marginBottom: '0.4rem' }}>Ton email de contact *</label>
            <input type="email" value={editorEmail} onChange={e => setEditorEmail(e.target.value)} placeholder="toi@gmail.com" />
          </div>

          <button className="btn-primary" onClick={handleSearch} disabled={loading} style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem' }}>
            {loading ? '⏳ Recherche en cours...' : 'Rechercher des chaînes →'}
          </button>
        </div>

        {searched && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
              <h3 className="font-display" style={{ fontWeight: 600, fontSize: '1rem' }}>
                {results.length} chaîne{results.length !== 1 ? 's' : ''} trouvée{results.length !== 1 ? 's' : ''}
              </h3>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#6B5F96' }}>{niche} · {lang}</span>
                <button onClick={exportCSV} style={{ background: isPro ? 'rgba(83,58,183,0.25)' : 'rgba(83,58,183,0.10)', border: '1px solid rgba(83,58,183,0.35)', color: isPro ? '#a78bfa' : '#6B5F96', padding: '0.35rem 0.75rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                  {isPro ? '📥 Export CSV' : '🔒 CSV Pro'}
                </button>
              </div>
            </div>

            {results.length === 0 ? (
              <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#A89FCC' }}>
                Aucune chaîne trouvée pour ces critères. Essaie d'autres filtres.
              </div>
            ) : (
              results.map(ch => (
                <div key={ch.id} className="card" style={{ padding: '1.25rem', marginBottom: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: ch.color + '33', border: `2px solid ${ch.color}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: ch.color, flexShrink: 0 }}>
                    {ch.avatar}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.2rem' }}>{ch.name}</div>

                    <div style={{
                      display: 'inline-block',
                      marginBottom: '0.35rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      ...getScoreStyles(ch.scoreColor, ch.score || 0),
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>
                      ⭐ {ch.scoreLabel || 'Potentiel faible'} · {ch.score || 0}/100
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#C4BCDF', marginBottom: '0.25rem' }}>
                      {ch.scoreReason || "Faible potentiel ou peu d'informations disponibles"}
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#A89FCC', marginBottom: '0.6rem' }}>
                      {ch.subs} abonnés · {ch.totalViewsFormatted || formatCompactNumber(ch.totalViews || 0)} vues · {ch.videoCountFormatted || formatCompactNumber(ch.videoCount || 0)} vidéos{getCreatedYear(ch.createdAt) ? ` · créée en ${getCreatedYear(ch.createdAt)}` : ''}
                    </div>

                    <div style={{
                      display: 'none',
                      marginBottom: '0.5rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      background: (ch.score || 0) >= 80 ? 'rgba(34,197,94,0.15)' : (ch.score || 0) >= 60 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                      color: (ch.score || 0) >= 80 ? '#22c55e' : (ch.score || 0) >= 60 ? '#eab308' : '#ef4444',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>
                      🎯 Score prospect : {ch.score || 0}/100
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#A89FCC', marginBottom: '0.6rem' }}>{ch.subs} abonnés · {ch.desc}</div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      {[ch.niche, ch.lang, ch.freq].map(tag => (
                        <span key={tag} style={{ fontSize: '0.75rem', padding: '0.15rem 0.6rem', borderRadius: '20px', background: 'rgba(83,58,183,0.15)', border: '1px solid rgba(83,58,183,0.3)', color: '#a78bfa' }}>{tag}</span>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.8rem' }}>
                      {ch.email ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <a href={`mailto:${ch.email}`} style={{ color: '#22c55e', textDecoration: 'none' }}>
                            📧 {ch.email}
                          </a>
                          <button onClick={() => copyEmail(ch.email)} style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', borderRadius: '6px', padding: '0.15rem 0.45rem', cursor: 'pointer', fontSize: '0.72rem' }}>
                            Copier
                          </button>
                        </div>
                      ) : (
                        <div style={{ color: '#6B5F96' }}>📭 Email non trouvé</div>
                      )}

                      {ch.channelUrl && (
                        <a href={ch.channelUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'none' }}>
                          🎥 Voir la chaîne YouTube
                        </a>
                      )}

                      {plan === 'Gratuit' ? (
                        <>
                          <div style={{ color: '#6B5F96' }}>🔒 Instagram disponible en Pro</div>
                          <div style={{ color: '#6B5F96' }}>🔒 TikTok disponible en Pro</div>
                          <div style={{ color: '#6B5F96' }}>🔒 Twitch disponible en Pro</div>
                          <div style={{ color: '#6B5F96' }}>🔒 Site web disponible en Pro</div>
                        </>
                      ) : (
                        <>
                          {ch.instagram ? (
                            <a href={ch.instagram} target="_blank" rel="noopener noreferrer" style={{ color: '#e879f9', textDecoration: 'none' }}>
                              📷 Instagram
                            </a>
                          ) : (
                            <div style={{ color: '#6B5F96' }}>📷 Instagram non trouvé</div>
                          )}

                          {ch.tiktok ? (
                            <a href={ch.tiktok} target="_blank" rel="noopener noreferrer" style={{ color: '#f472b6', textDecoration: 'none' }}>
                              🎵 TikTok
                            </a>
                          ) : (
                            <div style={{ color: '#6B5F96' }}>🎵 TikTok non trouvé</div>
                          )}

                          {ch.twitch ? (
                            <a href={ch.twitch} target="_blank" rel="noopener noreferrer" style={{ color: '#9146FF', textDecoration: 'none' }}>
                              🎮 Twitch
                            </a>
                          ) : (
                            <div style={{ color: '#6B5F96' }}>🎮 Twitch non trouvé</div>
                          )}

                          {ch.website ? (
                            <a href={ch.website} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                              🌐 Site web
                            </a>
                          ) : (
                            <div style={{ color: '#6B5F96' }}>🌐 Site web non trouvé</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ flexShrink: 0, display: 'grid', gap: '0.5rem' }}>
                    <button
                      onClick={() => addFavorite(ch)}
                      disabled={favoriteIds.includes(ch.id) || favoriteLoadingId === ch.id}
                      style={{ background: favoriteIds.includes(ch.id) ? 'rgba(234,179,8,0.16)' : 'rgba(83,58,183,0.15)', color: favoriteIds.includes(ch.id) ? '#eab308' : '#A89FCC', border: '1px solid rgba(83,58,183,0.35)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.82rem', cursor: favoriteIds.includes(ch.id) ? 'default' : 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
                    >
                      {favoriteIds.includes(ch.id) ? '⭐ Favori ajouté' : favoriteLoadingId === ch.id ? 'Ajout...' : '☆ Ajouter aux favoris'}
                    </button>
                    <button onClick={() => generateEmail(ch)} style={{ background: canEmail ? 'linear-gradient(135deg, #533AB7, #7B63D3)' : 'rgba(83,58,183,0.15)', color: canEmail ? 'white' : '#6B5F96', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.82rem', cursor: canEmail ? 'pointer' : 'not-allowed', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {canEmail ? '✨ Message IA' : '🔒 IA Pro'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {emailModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '560px', padding: '1.75rem', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="font-display" style={{ fontWeight: 700 }}>Message généré par IA ✨</h3>
              <button onClick={() => { setEmailModal(null); setEmailData(null); setSendStatus('') }} style={{ background: 'none', border: 'none', color: '#A89FCC', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            {emailLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#A89FCC' }}>
                <div style={{ marginBottom: '0.75rem', fontSize: '1.5rem' }}>⏳</div>
                Génération du message par IA...
              </div>
            ) : emailData ? (
              <>
                <div style={{ background: 'rgba(83,58,183,0.08)', border: '1px solid rgba(83,58,183,0.2)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6B5F96', marginBottom: '0.5rem' }}>
                    De : {editorEmail} → À : {emailModal.email || emailModal.name}
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                    Objet : {emailData.subject}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#C4BCDF', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {emailData.body}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn-primary" onClick={() => {
                    setSendStatus('✓ Message copié dans le presse-papiers !')
                    navigator.clipboard.writeText(`Objet: ${emailData.subject}\n\n${emailData.body}`)
                  }} style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem' }}>
                    📋 Copier le message
                  </button>
                  <button onClick={() => generateEmail(emailModal)} style={{ background: 'none', border: '1px solid rgba(83,58,183,0.4)', color: '#A89FCC', padding: '0.75rem 1rem', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    🔄 Régénérer
                  </button>
                </div>

                {sendStatus && <p style={{ color: '#22c55e', fontSize: '0.82rem', marginTop: '0.75rem', textAlign: 'center' }}>{sendStatus}</p>}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
