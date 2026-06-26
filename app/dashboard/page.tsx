'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLoader from '@/components/AppLoader'
import EmptyState from '@/components/EmptyState'
import ProspectSkeleton from '@/components/ProspectSkeleton'
import Toast, { useToast } from '@/components/Toast'

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

  if (color === 'orange') {
    return { background: 'rgba(249,115,22,0.15)', color: '#f97316' }
  }

  return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
}

type CampaignOption = {
  id: string
  name: string
  _count?: { prospects: number }
  prospectChannelIds?: string[]
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
  const [cacheNotice, setCacheNotice] = useState(false)
  const [expandedAnalysisIds, setExpandedAnalysisIds] = useState<string[]>([])

  const [emailModal, setEmailModal] = useState<any>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailData, setEmailData] = useState<{ subject: string; body: string } | null>(null)
  const [sendStatus, setSendStatus] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [bulkCampaignId, setBulkCampaignId] = useState('')
  const [bulkCampaignName, setBulkCampaignName] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkCampaignsLoading, setBulkCampaignsLoading] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [campaignTargetIds, setCampaignTargetIds] = useState<string[]>([])
  const { toast, showToast } = useToast()

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
    showToast('✓ Email copié')
  }

  const exportCSV = () => {
    if (!isPro) return showToast('Export CSV disponible avec le plan Pro.', 'info')

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
    if (!niche) return showToast('Choisissez une niche avant de lancer la recherche.', 'info')
    if (!editorEmail) return showToast('Ajoutez votre email de contact avant de continuer.', 'info')
    setLoading(true)
    setSearched(false)
    setCacheNotice(false)
    setSelectedIds([])

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche, lang, subsMin: String(subsMin), subsMax: String(subsMax) }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      if (data.upgrade) return showToast('Quota épuisé. Passez au plan Pro pour continuer.', 'info')
      return showToast(data.error || 'La recherche a échoué.', 'error')
    }

    setResults(data.results)
    setCanEmail(data.canGenerateEmail)
    setSearchesLeft(data.searchesRemaining)
    setPlan(data.plan)
    setSearched(true)

    if (data.cached) {
      setCacheNotice(true)
      window.setTimeout(() => setCacheNotice(false), 3500)
    }
  }

  const generateEmail = async (channel: any) => {
    if (!canEmail) return showToast('Le plan Pro est requis pour générer des messages IA.', 'info')

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
      if (data.upgrade) return showToast('Plan Pro requis pour les messages IA.', 'info')
      return showToast(data.error || 'Impossible de générer le message.', 'error')
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

    if (!res.ok) return showToast(data.error || "Impossible d'ajouter ce favori.", 'error')

    const channelId = data.favorite?.channelId || channel.id
    setFavoriteIds(current => current.includes(channelId) ? current : [...current, channelId])
    showToast('✓ Prospect ajouté')
  }

  const addToCampaign = (channel: any) => {
    const channelId = channel?.channelId || channel?.id
    if (!channelId) return showToast('Cette chaîne ne peut pas être ajoutée.', 'error')

    openBulkModal([channelId])
  }

  const toggleSelected = (channelId: string) => {
    setSelectedIds(current =>
      current.includes(channelId)
        ? current.filter(id => id !== channelId)
        : [...current, channelId]
    )
  }

  const openBulkModal = async (targetIds = selectedIds) => {
    setBulkModalOpen(true)
    setBulkCampaignId('new')
    setBulkCampaignName('')
    setBulkError('')
    setCampaignTargetIds(targetIds)
    setBulkCampaignsLoading(true)
    const res = await fetch('/api/campaigns')
    const data = await res.json().catch(() => ({}))
    setBulkCampaignsLoading(false)
    if (res.ok) setCampaigns(data.campaigns || [])
    else setBulkError(data.error || 'Impossible de charger les campagnes.')
  }

  const getTargetChannels = () => {
    const targetIds = campaignTargetIds.length > 0 ? campaignTargetIds : selectedIds
    return results.filter(channel =>
      targetIds.includes(channel.channelId) || targetIds.includes(channel.id)
    )
  }

  const isCampaignFullyPopulated = (campaign: CampaignOption) => {
    const targetChannelIds = getTargetChannels()
      .map(channel => channel.channelId || channel.id)
      .filter(Boolean)
    const existingIds = new Set(campaign.prospectChannelIds || [])

    return targetChannelIds.length > 0 && targetChannelIds.every(channelId => existingIds.has(channelId))
  }

  const addSelectedToCampaign = async () => {
    const targetIds = campaignTargetIds.length > 0 ? campaignTargetIds : selectedIds
    const selectedChannels = getTargetChannels()
    if (selectedChannels.length === 0) return

    setBulkLoading(true)
    setBulkError('')
    let campaignId = bulkCampaignId === 'new' ? '' : bulkCampaignId

    if (!campaignId) {
      const name = bulkCampaignName.trim()
      if (!name) {
        setBulkLoading(false)
        setBulkError('Entre un nom de campagne.')
        return
      }

      const createRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const createData = await createRes.json().catch(() => ({}))
      if (!createRes.ok) {
        setBulkLoading(false)
        setBulkError(createData.error || 'Impossible de créer la campagne.')
        return
      }
      campaignId = createData.campaign.id
      showToast('✓ Campagne créée')
    }

    const outcomes = await Promise.all(selectedChannels.map(async channel => {
      const response = await fetch(`/api/campaigns/${campaignId}/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channel),
      })
      const data = await response.json().catch(() => ({}))
      return { response, data }
    }))

    const failed = outcomes.find(({ response }) => !response.ok)
    if (failed) {
      setBulkLoading(false)
      setBulkError(failed.data.error || "Certains prospects n'ont pas pu être ajoutés.")
      return
    }

    const addedCount = outcomes.filter(({ data }) => data.added === true).length
    const existingCount = selectedChannels.length - addedCount

    setBulkLoading(false)
    setBulkModalOpen(false)
    setCampaignTargetIds([])
    setSelectedIds(current => current.filter(id => !targetIds.includes(id)))

    if (addedCount === 0) {
      showToast('Tous les prospects sont déjà présents dans cette campagne.')
      return
    }

    const addedLabel = `${addedCount} prospect${addedCount !== 1 ? 's' : ''} ajouté${addedCount !== 1 ? 's' : ''}`
    const existingLabel = existingCount > 0
      ? `\nℹ️ ${existingCount} étai${existingCount !== 1 ? 'ent' : 't'} déjà dans cette campagne`
      : ''
    showToast(`✅ ${addedLabel}${existingLabel}`)
  }

  const selectedCampaignIsFull = campaigns.some(
    campaign => campaign.id === bulkCampaignId && isCampaignFullyPopulated(campaign)
  )

  const toggleAnalysis = (channelId: string) => {
    setExpandedAnalysisIds(current =>
      current.includes(channelId)
        ? current.filter(id => id !== channelId)
        : [...current, channelId]
    )
  }

  if (status === 'loading') return <AppLoader text="Chargement de votre espace de recherche..." />

  return (
    <div style={{ minHeight: '100vh', background: '#0A0812' }}>
      <nav className="app-nav" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,8,18,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(83,58,183,0.2)', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <Link href="/dashboard/home" style={{ textDecoration: 'none' }}>
          <div className="font-display" style={{ fontWeight: 800, fontSize: '1.2rem', color: '#F0EDF8' }}>
            Prospect<span className="grad-text">Tube</span>
          </div>
        </Link>
        <div className="app-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard/home" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>
            🏠 Accueil
          </Link>
          <Link href="/favorites" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>
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

        <div id="search-form" className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', scrollMarginTop: '90px' }}>
          <h2 className="font-display" style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
            🔍 Rechercher des chaînes YouTube
          </h2>

          <div className="search-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
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

        {loading && (
          <div role="status" aria-label="Recherche des chaînes en cours">
            {[0, 1, 2].map(item => <ProspectSkeleton key={item} />)}
          </div>
        )}

        {cacheNotice && (
          <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
            ⚡ Résultats instantanés (cache)
          </div>
        )}

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
              <EmptyState
                icon="🔍"
                title="Aucune chaîne trouvée"
                description="Élargissez la plage d’abonnés ou essayez une autre niche pour obtenir davantage de résultats."
                actionLabel="Modifier les critères"
                actionHref="#search-form"
              />
            ) : (
              results.map(ch => (
                <div key={ch.id} className="card prospect-card" style={{ position: 'relative', padding: '1rem', marginBottom: '0.85rem', display: 'block', border: selectedIds.includes(ch.id) ? '1px solid rgba(167,139,250,0.65)' : '1px solid rgba(83,58,183,0.24)', boxShadow: '0 16px 40px rgba(0,0,0,0.18)' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(ch.id)}
                    onChange={() => toggleSelected(ch.id)}
                    aria-label={`Sélectionner ${ch.name}`}
                    style={{ position: 'absolute', top: '0.85rem', right: '0.85rem', width: '16px', height: '16px', accentColor: '#7B63D3', cursor: 'pointer' }}
                  />
                  {(() => {
                    const isExpanded = expandedAnalysisIds.includes(ch.id)
                    const reasons = String(ch.scoreReason || "Peu d'informations exploitables").split(' • ').filter(Boolean)
                    const contacts = [
                      ch.email ? { label: '📧 Email trouvé', href: `mailto:${ch.email}`, color: '#22c55e' } : null,
                      ch.instagram ? { label: '📱 Instagram', href: ch.instagram, color: '#e879f9' } : null,
                      ch.tiktok ? { label: '🎵 TikTok', href: ch.tiktok, color: '#f472b6' } : null,
                      ch.twitch ? { label: '🎮 Twitch', href: ch.twitch, color: '#9146FF' } : null,
                      ch.website ? { label: '🌍 Site', href: ch.website, color: '#38bdf8' } : null,
                    ].filter(Boolean) as { label: string; href: string; color: string }[]
                    const statBadges = [
                      `👥 ${ch.subs || formatCompactNumber(ch.subsNum || 0)}`,
                      `👁 ${ch.totalViewsFormatted || formatCompactNumber(ch.totalViews || ch.viewCount || 0)}`,
                      `🎬 ${ch.videoCountFormatted || formatCompactNumber(ch.videoCount || 0)}`,
                      getCreatedYear(ch.createdAt || ch.publishedAt) ? `📅 ${getCreatedYear(ch.createdAt || ch.publishedAt)}` : null,
                    ].filter(Boolean)

                    return (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '1rem', alignItems: 'start' }}>
                          <div style={{ display: 'flex', gap: '0.9rem', minWidth: 0 }}>
                            {ch.thumbnail ? (
                              <img src={ch.thumbnail} alt="" style={{ width: '54px', height: '54px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(83,58,183,0.35)', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: ch.color + '33', border: `2px solid ${ch.color}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', color: ch.color, flexShrink: 0 }}>
                                {ch.avatar}
                              </div>
                            )}

                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F0EDF8', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name}</div>
                                <span style={{ padding: '0.18rem 0.55rem', borderRadius: '999px', ...getScoreStyles(ch.scoreColor, ch.score || 0), fontSize: '0.72rem', fontWeight: 700 }}>
                                  {ch.scoreLabel || '🔴 Faible potentiel'}
                                </span>
                                <span style={{ color: '#F0EDF8', fontWeight: 800, fontSize: '0.9rem' }}>{ch.score || 0}/100</span>
                              </div>

                              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
                                {statBadges.map(stat => (
                                  <span key={stat} style={{ fontSize: '0.75rem', color: '#C4BCDF', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '0.22rem 0.55rem' }}>{stat}</span>
                                ))}
                              </div>

                              {contacts.length > 0 && (
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  {contacts.map(contact => (
                                    <a key={contact.label} href={contact.href} target={contact.href.startsWith('http') ? '_blank' : undefined} rel={contact.href.startsWith('http') ? 'noopener noreferrer' : undefined} style={{ fontSize: '0.75rem', color: contact.color, background: `${contact.color}1F`, border: `1px solid ${contact.color}3D`, borderRadius: '999px', padding: '0.22rem 0.55rem', textDecoration: 'none', fontWeight: 600 }}>
                                      {contact.label}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="prospect-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.55rem', marginTop: '0.9rem' }}>
                          <button onClick={() => addFavorite(ch)} disabled={favoriteIds.includes(ch.id) || favoriteLoadingId === ch.id} style={{ background: favoriteIds.includes(ch.id) ? 'rgba(234,179,8,0.16)' : 'rgba(83,58,183,0.14)', color: favoriteIds.includes(ch.id) ? '#eab308' : '#A89FCC', border: '1px solid rgba(83,58,183,0.35)', padding: '0.55rem 0.65rem', borderRadius: '8px', cursor: favoriteIds.includes(ch.id) ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                            {favoriteIds.includes(ch.id) ? '⭐ Favori' : favoriteLoadingId === ch.id ? 'Ajout...' : '☆ Favori'}
                          </button>
                          <button onClick={() => generateEmail(ch)} style={{ background: canEmail ? 'linear-gradient(135deg, #533AB7, #7B63D3)' : 'rgba(83,58,183,0.15)', color: canEmail ? 'white' : '#6B5F96', border: '1px solid rgba(83,58,183,0.22)', padding: '0.55rem 0.65rem', borderRadius: '8px', cursor: canEmail ? 'pointer' : 'not-allowed', fontSize: '0.8rem', fontWeight: 700 }}>
                            {canEmail ? '✨ Message IA' : '🔒 IA Pro'}
                          </button>
                          <button onClick={() => addToCampaign(ch)} style={{ background: 'rgba(83,58,183,0.14)', color: '#A89FCC', border: '1px solid rgba(83,58,183,0.35)', padding: '0.55rem 0.65rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                            Ajouter à campagne
                          </button>
                          <button onClick={() => toggleAnalysis(ch.id)} style={{ background: 'rgba(255,255,255,0.04)', color: '#C4BCDF', border: '1px solid rgba(255,255,255,0.09)', padding: '0.55rem 0.65rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                            {isExpanded ? '▼ Masquer' : '▶ Voir l’analyse'}
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateRows: isExpanded ? '1fr' : '0fr', transition: 'grid-template-rows 220ms ease, opacity 220ms ease', opacity: isExpanded ? 1 : 0 }}>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ borderTop: '1px solid rgba(83,58,183,0.22)', marginTop: '1rem', paddingTop: '1rem' }}>
                              <div style={{ fontWeight: 700, color: '#F0EDF8', fontSize: '0.9rem', marginBottom: '0.55rem' }}>Pourquoi ce score ?</div>
                              <div style={{ display: 'grid', gap: '0.3rem', color: '#C4BCDF', fontSize: '0.82rem', marginBottom: '1rem' }}>
                                {reasons.map(reason => <div key={reason}>✓ {reason}</div>)}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(180px, 0.8fr)', gap: '1rem' }}>
                                <div>
                                  <div style={{ fontWeight: 700, color: '#F0EDF8', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Description</div>
                                  <div style={{ color: '#A89FCC', fontSize: '0.82rem', lineHeight: 1.6 }}>{ch.desc || 'Pas de description disponible.'}</div>
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, color: '#F0EDF8', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Contacts</div>
                                  <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.8rem' }}>
                                    {ch.email && <a href={`mailto:${ch.email}`} style={{ color: '#22c55e', textDecoration: 'none' }}>📧 {ch.email}</a>}
                                    {ch.channelUrl && <a href={ch.channelUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'none' }}>▶ YouTube</a>}
                                    {ch.instagram && <a href={ch.instagram} target="_blank" rel="noopener noreferrer" style={{ color: '#e879f9', textDecoration: 'none' }}>📱 Instagram</a>}
                                    {ch.tiktok && <a href={ch.tiktok} target="_blank" rel="noopener noreferrer" style={{ color: '#f472b6', textDecoration: 'none' }}>🎵 TikTok</a>}
                                    {ch.twitch && <a href={ch.twitch} target="_blank" rel="noopener noreferrer" style={{ color: '#9146FF', textDecoration: 'none' }}>🎮 Twitch</a>}
                                    {ch.website && <a href={ch.website} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>🌍 Site</a>}
                                    {!ch.email && !ch.channelUrl && contacts.length === 0 && <span style={{ color: '#6B5F96' }}>Aucun contact public trouvé</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                  <div style={{ display: 'none', width: '42px', height: '42px', borderRadius: '50%', background: ch.color + '33', border: `2px solid ${ch.color}66`, alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: ch.color, flexShrink: 0 }}>
                    {ch.avatar}
                  </div>

                  <div style={{ display: 'none', flex: 1, minWidth: 0 }}>
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
                      {ch.scoreLabel || '🔴 Faible potentiel'}
                    </div>

                    <div style={{ fontSize: '0.9rem', color: '#F0EDF8', fontWeight: 700, marginBottom: '0.35rem' }}>
                      {ch.score || 0}/100
                    </div>

                    <div style={{ display: 'grid', gap: '0.2rem', fontSize: '0.82rem', color: '#C4BCDF', marginBottom: '0.6rem' }}>
                      {String(ch.scoreReason || "Peu d'informations exploitables").split(' • ').map((reason: string) => (
                        <div key={reason}>{reason}</div>
                      ))}
                    </div>

                    <div style={{
                      display: 'none',
                      marginBottom: '0.35rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      ...getScoreStyles(ch.scoreColor, ch.score || 0),
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>
                      ⭐ {ch.scoreLabel || 'Potentiel faible'} · {ch.score || 0}/100
                    </div>

                    <div style={{ display: 'none', fontSize: '0.82rem', color: '#C4BCDF', marginBottom: '0.25rem' }}>
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

                  <div style={{ flexShrink: 0, display: 'none', gap: '0.5rem' }}>
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

      {selectedIds.length > 0 && (
        <div style={{ position: 'fixed', left: '50%', bottom: '1rem', transform: 'translateX(-50%)', zIndex: 900, width: 'min(620px, calc(100% - 2rem))', background: 'rgba(18,14,31,0.96)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.45)', padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ color: '#F0EDF8', fontWeight: 700, fontSize: '0.9rem' }}>
            {selectedIds.length} prospect{selectedIds.length !== 1 ? 's' : ''} sélectionné{selectedIds.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => openBulkModal()} style={{ background: 'linear-gradient(135deg, #533AB7, #7B63D3)', color: 'white', border: 'none', padding: '0.6rem 0.85rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
              Ajouter à une campagne
            </button>
            <button onClick={() => setSelectedIds([])} style={{ background: 'rgba(255,255,255,0.04)', color: '#C4BCDF', border: '1px solid rgba(255,255,255,0.09)', padding: '0.6rem 0.85rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
              Vider la sélection
            </button>
          </div>
        </div>
      )}

      {bulkModalOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={() => setBulkModalOpen(false)}>
          <div className="card modal-panel" role="dialog" aria-modal="true" aria-labelledby="campaign-modal-title" style={{ width: '100%', maxWidth: '460px', padding: '1.5rem' }} onClick={event => event.stopPropagation()}>
            <h3 id="campaign-modal-title" className="font-display" style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Ajouter à une campagne</h3>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#A89FCC', marginBottom: '0.35rem' }}>Campagne existante</label>
            <select value={bulkCampaignId} onChange={event => setBulkCampaignId(event.target.value)} disabled={bulkCampaignsLoading} style={{ marginBottom: '1rem' }}>
              <option value="new">+ Créer une nouvelle campagne</option>
              {campaigns.map(campaign => {
                const alreadyPresent = isCampaignFullyPopulated(campaign)
                return (
                <option key={campaign.id} value={campaign.id} disabled={alreadyPresent}>
                  {campaign.name} ({campaign._count?.prospects || 0} prospect{(campaign._count?.prospects || 0) !== 1 ? 's' : ''}){alreadyPresent ? ' - ✓ Déjà présents' : ''}
                </option>
                )
              })}
            </select>
            {bulkCampaignsLoading && (
              <div style={{ marginBottom: '1rem' }}><AppLoader text="Chargement des campagnes..." fullScreen={false} compact /></div>
            )}
            {bulkCampaignId === 'new' && (
              <>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#A89FCC', marginBottom: '0.35rem' }}>Nouvelle campagne</label>
                <input value={bulkCampaignName} onChange={event => setBulkCampaignName(event.target.value)} placeholder="Nom de campagne" style={{ marginBottom: '1rem' }} />
              </>
            )}
            {bulkError && (
              <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '0.6rem 0.75rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
                {bulkError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setBulkModalOpen(false); setCampaignTargetIds([]); setBulkError('') }} disabled={bulkLoading} style={{ background: 'rgba(255,255,255,0.04)', color: '#C4BCDF', border: '1px solid rgba(255,255,255,0.09)', padding: '0.65rem 0.9rem', borderRadius: '8px', cursor: bulkLoading ? 'default' : 'pointer' }}>Annuler</button>
              <button onClick={addSelectedToCampaign} disabled={bulkLoading || bulkCampaignsLoading || selectedCampaignIsFull || (bulkCampaignId === 'new' && !bulkCampaignName.trim())} className="btn-primary" style={{ padding: '0.65rem 0.9rem' }}>
                {bulkLoading ? 'Ajout...' : `Ajouter ${campaignTargetIds.length || selectedIds.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} raised={selectedIds.length > 0} />

      {emailModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card modal-panel" role="dialog" aria-modal="true" aria-labelledby="email-modal-title" style={{ width: '100%', maxWidth: '560px', padding: '1.75rem', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 id="email-modal-title" className="font-display" style={{ fontWeight: 700 }}>Message généré par IA ✨</h3>
              <button aria-label="Fermer la fenêtre" onClick={() => { setEmailModal(null); setEmailData(null); setSendStatus('') }} style={{ background: 'none', border: 'none', color: '#A89FCC', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            {emailLoading ? (
              <AppLoader text="Génération du message par IA..." fullScreen={false} />
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
