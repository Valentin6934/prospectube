'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLoader from '@/components/AppLoader'
import EmptyState from '@/components/EmptyState'
import Toast, { useToast } from '@/components/Toast'

type CampaignSummary = {
  id: string
  name: string
  status: string
  createdAt: string
  updatedAt: string
  _count?: { prospects: number }
}

type CampaignProspect = {
  id: string
  channelId: string
  name: string
  email: string | null
  instagram: string | null
  tiktok: string | null
  twitch: string | null
  website: string | null
  channelUrl: string | null
  score: number | null
  scoreLabel: string | null
  scoreReason: string | null
  generatedSubject: string | null
  generatedBody: string | null
  status: string
  sendStatus: string
  sentAt: string | null
  sendError: string | null
  createdAt: string
}

type CampaignDetails = CampaignSummary & {
  prospects: CampaignProspect[]
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

export default function CampaignsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [sendingProspectIds, setSendingProspectIds] = useState<string[]>([])
  const [newCampaignName, setNewCampaignName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [scoreFilter, setScoreFilter] = useState('Tous')
  const [selectedProspectIds, setSelectedProspectIds] = useState<string[]>([])
  const { toast, showToast } = useToast()
  const plan = (session?.user as any)?.plan || 'Gratuit'
  const canGenerate = plan === 'Pro' || plan === 'Agence'

  const getScoreBucket = (prospect: CampaignProspect) => {
    const label = `${prospect.scoreLabel || ''} ${prospect.score || ''}`.toLowerCase()
    const score = prospect.score || 0
    if (label.includes('exceptionnel') || label.includes('excellent') || score >= 80) return 'Excellent'
    if (label.includes('bon') || score >= 65) return 'Bon'
    if (label.includes('moyen') || score >= 50) return 'Moyen'
    return 'Faible'
  }

  const getCampaignStats = (prospects: CampaignProspect[]) => {
    const total = prospects.length
    const withEmail = prospects.filter(prospect => Boolean(prospect.email)).length
    const averageScore = total > 0 ? Math.round(prospects.reduce((sum, prospect) => sum + (prospect.score || 0), 0) / total) : 0
    return {
      total,
      withEmail,
      averageScore,
      excellent: prospects.filter(prospect => getScoreBucket(prospect) === 'Excellent').length,
      bon: prospects.filter(prospect => getScoreBucket(prospect) === 'Bon').length,
      moyen: prospects.filter(prospect => getScoreBucket(prospect) === 'Moyen').length,
      faible: prospects.filter(prospect => getScoreBucket(prospect) === 'Faible').length,
    }
  }
  const filteredProspects = (selectedCampaign?.prospects || []).filter(prospect => {
    const search = searchTerm.trim().toLowerCase()
    const matchesSearch = !search || [prospect.name, prospect.email, prospect.scoreLabel]
      .some(value => (value || '').toLowerCase().includes(search))
    const matchesFilter =
      scoreFilter === 'Tous' ||
      (scoreFilter === 'Sans email' ? !prospect.email : getScoreBucket(prospect) === scoreFilter)

    return matchesSearch && matchesFilter
  })
  const campaignStats = selectedCampaign ? getCampaignStats(selectedCampaign.prospects) : null

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const loadCampaigns = async () => {
    const res = await fetch('/api/campaigns')
    const data = await res.json().catch(() => ({ campaigns: [] }))
    setCampaigns(res.ok ? data.campaigns || [] : [])
  }

  useEffect(() => {
    if (status !== 'authenticated') return

    loadCampaigns().finally(() => setLoading(false))
  }, [status])

  const createCampaign = async () => {
    const name = newCampaignName.trim()
    if (!name) return

    setCreating(true)
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json().catch(() => ({}))
    setCreating(false)

    if (!res.ok) {
      showToast(data.error || 'Impossible de créer la campagne.', 'error')
      return
    }

    setNewCampaignName('')
    setCampaigns(current => [data.campaign, ...current])
    openCampaign(data.campaign.id)
    showToast('✓ Campagne créée')
  }

  const openCampaign = async (campaignId: string, preserveSelection = false) => {
    setOpeningId(campaignId)
    const res = await fetch(`/api/campaigns/${campaignId}`)
    const data = await res.json().catch(() => ({}))
    setOpeningId(null)

    if (!res.ok) {
      showToast(data.error || 'Impossible de charger la campagne.', 'error')
      return
    }

    setSelectedCampaign(data.campaign)
    if (!preserveSelection) setSelectedProspectIds([])
  }

  const deleteCampaign = async (campaignId: string) => {
    if (!window.confirm('Supprimer cette campagne ?')) return

    setDeletingId(campaignId)
    const res = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setDeletingId(null)

    if (!res.ok) {
      showToast(data.error || 'Impossible de supprimer la campagne.', 'error')
      return
    }

    setCampaigns(current => current.filter(campaign => campaign.id !== campaignId))
    if (selectedCampaign?.id === campaignId) setSelectedCampaign(null)
    showToast('✓ Campagne supprimée')
  }

  const generateCampaignEmails = async () => {
    if (!selectedCampaign) return
    if (!canGenerate) return showToast('Le plan Pro est requis pour générer des messages IA en campagne.', 'info')
    if (selectedProspectIds.length === 0) return showToast('Sélectionnez au moins un prospect à générer.', 'info')

    setGenerating(true)
    const res = await fetch(`/api/campaigns/${selectedCampaign.id}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectIds: selectedProspectIds }),
    })
    const data = await res.json().catch(() => ({}))
    setGenerating(false)

    if (!res.ok) {
      if (data.upgrade) return showToast('Plan Pro requis pour les campagnes IA.', 'info')
      return showToast(data.error || 'Impossible de générer les messages.', 'error')
    }

    await openCampaign(selectedCampaign.id)
    showToast('✓ Messages générés')
  }

  const copyMessage = async (prospect: CampaignProspect) => {
    const message = [prospect.generatedSubject ? `Objet: ${prospect.generatedSubject}` : '', prospect.generatedBody || '']
      .filter(Boolean)
      .join('\n\n')
    if (!message) return

    await navigator.clipboard.writeText(message)
    showToast('✓ Message copié')
  }

  const sendCampaignMessages = async (prospectIds: string[]) => {
    if (!selectedCampaign || prospectIds.length === 0) {
      showToast('Sélectionnez au moins un prospect.', 'info')
      return
    }

    const selectedProspects = selectedCampaign.prospects.filter(prospect => prospectIds.includes(prospect.id))
    if (selectedProspects.every(prospect => !prospect.email)) {
      showToast('Aucun email disponible.', 'info')
      return
    }

    const ids = prospectIds.slice(0, 20)
    setSendingProspectIds(ids)
    const response = await fetch(`/api/campaigns/${selectedCampaign.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectIds: ids }),
    })
    const data = await response.json().catch(() => ({}))
    setSendingProspectIds([])

    if (!response.ok) {
      if (data.gmailNotConnected) {
        showToast('Connectez Gmail depuis les Paramètres avant l’envoi.', 'info')
        return
      }
      showToast(data.error || 'Erreur Gmail.', 'error')
      return
    }

    await openCampaign(selectedCampaign.id, true)

    if (data.successCount === 0) {
      const firstError = data.results?.find((result: { error?: string }) => result.error)?.error
      showToast(firstError || 'Aucun message envoyé.', 'info')
      return
    }

    const action = data.mode === 'send'
      ? `envoyé${data.successCount > 1 ? 's' : ''}`
      : `créé${data.successCount > 1 ? 's' : ''} en brouillon${data.successCount > 1 ? 's' : ''}`
    const suffix = data.errorCount > 0 ? ` · ${data.errorCount} ignoré${data.errorCount > 1 ? 's' : ''}` : ''
    showToast(`${data.successCount} message${data.successCount > 1 ? 's' : ''} ${action}${suffix}`)
  }

  const toggleSelectedProspect = (prospectId: string) => {
    setSelectedProspectIds(current =>
      current.includes(prospectId)
        ? current.filter(id => id !== prospectId)
        : [...current, prospectId]
    )
  }

  if (status === 'loading' || loading) return <AppLoader text="Chargement de vos campagnes..." />

  return (
    <div style={{ minHeight: '100vh', background: '#0A0812' }}>
      <nav className="app-nav" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,8,18,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(83,58,183,0.2)', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <Link href="/dashboard/home" style={{ textDecoration: 'none' }}>
          <div className="font-display" style={{ fontWeight: 800, fontSize: '1.2rem', color: '#F0EDF8' }}>
            Prospect<span className="grad-text">Tube</span>
          </div>
        </Link>
        <div className="app-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard/home" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>🏠 Accueil</Link>
          <Link href="/dashboard" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>Nouvelle recherche</Link>
          <Link href="/favorites" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>⭐ Mes favoris</Link>
          <Link href="/history" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>📁 Historique</Link>
          <Link href="/campaigns" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.85rem' }}>📧 Campagnes</Link>
          <Link href="/settings" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>⚙ Paramètres</Link>
          <div style={{ background: 'rgba(83,58,183,0.2)', border: '1px solid rgba(83,58,183,0.4)', color: '#a78bfa', padding: '0.2rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 500 }}>
            Plan {plan}
          </div>
          <button onClick={() => signOut({ callbackUrl: '/' })} style={{ background: 'none', border: '1px solid rgba(83,58,183,0.3)', color: '#A89FCC', padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
            Déconnexion
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <h2 className="font-display" style={{ fontWeight: 700, fontSize: '1.2rem' }}>📧 Campagnes</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input value={newCampaignName} onChange={event => setNewCampaignName(event.target.value)} placeholder="Nom de campagne" style={{ minWidth: '220px' }} />
            <button onClick={createCampaign} disabled={creating || !newCampaignName.trim()} className="btn-primary" style={{ padding: '0.65rem 1rem', fontSize: '0.85rem' }}>
              {creating ? 'Création...' : 'Créer'}
            </button>
          </div>
        </div>

        <div className="campaign-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.8fr) minmax(0, 1.2fr)', gap: '1rem' }}>
          <div>
            {campaigns.length === 0 ? (
              <EmptyState
                icon="📧"
                title="Aucune campagne"
                description="Créez votre première campagne pour regrouper des prospects et préparer vos messages."
              />
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {campaigns.map(campaign => (
                  <div key={campaign.id} className="card" style={{ padding: '1rem', border: selectedCampaign?.id === campaign.id ? '1px solid rgba(167,139,250,0.5)' : undefined }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'start' }}>
                      <div>
                        <div style={{ color: '#F0EDF8', fontWeight: 700, marginBottom: '0.3rem' }}>{campaign.name}</div>
                        <div style={{ color: '#A89FCC', fontSize: '0.8rem' }}>
                          {campaign.status} · {campaign._count?.prospects || 0} prospect{(campaign._count?.prospects || 0) !== 1 ? 's' : ''}
                        </div>
                        <div style={{ color: '#6B5F96', fontSize: '0.75rem', marginTop: '0.25rem' }}>{formatDate(campaign.createdAt)}</div>
                      </div>
                      <button onClick={() => deleteCampaign(campaign.id)} disabled={deletingId === campaign.id} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '0.4rem 0.6rem', borderRadius: '8px', cursor: deletingId === campaign.id ? 'default' : 'pointer', fontSize: '0.78rem' }}>
                        {deletingId === campaign.id ? '...' : 'Supprimer'}
                      </button>
                    </div>
                    <button onClick={() => openCampaign(campaign.id)} disabled={openingId === campaign.id} style={{ marginTop: '0.8rem', width: '100%', background: 'rgba(83,58,183,0.18)', border: '1px solid rgba(83,58,183,0.32)', color: '#a78bfa', padding: '0.55rem 0.75rem', borderRadius: '8px', cursor: openingId === campaign.id ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                      {openingId === campaign.id ? <span className="button-loader"><span className="app-spinner" /> Ouverture...</span> : 'Ouvrir'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            {!selectedCampaign ? (
              <div className="card" style={{ padding: '2rem', color: '#A89FCC', textAlign: 'center' }}>
                Ouvre une campagne pour voir ses prospects et générer les messages.
              </div>
            ) : (
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h3 className="font-display" style={{ color: '#F0EDF8', fontSize: '1rem', marginBottom: '0.25rem' }}>{selectedCampaign.name}</h3>
                    <div style={{ color: '#A89FCC', fontSize: '0.82rem' }}>
                      {selectedCampaign.prospects.length} prospect{selectedCampaign.prospects.length !== 1 ? 's' : ''} · {selectedProspectIds.length} sélectionné{selectedProspectIds.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                    <button onClick={generateCampaignEmails} disabled={generating || !canGenerate || selectedProspectIds.length === 0 || sendingProspectIds.length > 0} style={{ background: canGenerate ? 'linear-gradient(135deg, #533AB7, #7B63D3)' : 'rgba(83,58,183,0.15)', color: canGenerate ? 'white' : '#6B5F96', border: '1px solid rgba(83,58,183,0.22)', padding: '0.65rem 1rem', borderRadius: '8px', cursor: generating || !canGenerate || selectedProspectIds.length === 0 ? 'default' : 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>
                      {generating ? 'Génération...' : canGenerate ? `✨ Générer la sélection (${selectedProspectIds.length})` : '🔒 IA Pro'}
                    </button>
                    <button
                      onClick={() => sendCampaignMessages(selectedProspectIds)}
                      disabled={sendingProspectIds.length > 0 || selectedProspectIds.length === 0}
                      className="btn btn-secondary"
                    >
                      {sendingProspectIds.length > 0
                        ? <span className="button-loader"><span className="app-spinner" /> Envoi...</span>
                        : `✉ Envoyer la sélection (${Math.min(selectedProspectIds.length, 20)})`}
                    </button>
                  </div>
                </div>

                {campaignStats && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.55rem', marginBottom: '1rem' }}>
                    {[
                      ['Prospects', campaignStats.total],
                      ['Avec email', campaignStats.withEmail],
                      ['Score moyen', `${campaignStats.averageScore}/100`],
                      ['Excellent', campaignStats.excellent],
                      ['Bon', campaignStats.bon],
                      ['Moyen', campaignStats.moyen],
                      ['Faible', campaignStats.faible],
                    ].map(([label, value]) => (
                      <div key={label} style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.65rem' }}>
                        <div style={{ color: '#6B5F96', fontSize: '0.72rem', marginBottom: '0.2rem' }}>{label}</div>
                        <div style={{ color: '#F0EDF8', fontWeight: 800, fontSize: '0.95rem' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="campaign-filters" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.65rem', marginBottom: '1rem' }}>
                  <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Rechercher nom, email ou score..." />
                  <select value={scoreFilter} onChange={event => setScoreFilter(event.target.value)} style={{ minWidth: '150px' }}>
                    {['Tous', 'Excellent', 'Bon', 'Moyen', 'Faible', 'Sans email'].map(filter => <option key={filter} value={filter}>{filter}</option>)}
                  </select>
                </div>

                {selectedCampaign.prospects.length === 0 ? (
                  <div style={{ padding: '1.25rem', textAlign: 'center', color: '#A89FCC', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
                    Aucun prospect dans cette campagne.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {filteredProspects.length === 0 && (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#A89FCC', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
                        Aucun prospect ne correspond aux filtres.
                      </div>
                    )}
                    {filteredProspects.map(prospect => (
                      <div key={prospect.id} style={{ border: selectedProspectIds.includes(prospect.id) ? '1px solid rgba(167,139,250,0.65)' : '1px solid rgba(83,58,183,0.22)', borderRadius: '10px', padding: '0.9rem', background: 'rgba(255,255,255,0.025)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', marginBottom: '0.6rem' }}>
                          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'start' }}>
                            <input type="checkbox" checked={selectedProspectIds.includes(prospect.id)} onChange={() => toggleSelectedProspect(prospect.id)} aria-label={`Sélectionner ${prospect.name}`} style={{ marginTop: '0.2rem', accentColor: '#7B63D3', cursor: 'pointer' }} />
                            <div>
                            <div style={{ color: '#F0EDF8', fontWeight: 700 }}>{prospect.name}</div>
                            <div style={{ color: '#A89FCC', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                              {prospect.scoreLabel || 'Score inconnu'} · {prospect.score || 0}/100
                            </div>
                            </div>
                          </div>
                          <span style={{ color: prospect.generatedBody ? '#22c55e' : '#eab308', background: prospect.generatedBody ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: 700 }}>
                            {prospect.status}
                          </span>
                        </div>

                        <div style={{ color: '#C4BCDF', fontSize: '0.82rem', marginBottom: '0.65rem' }}>
                          {prospect.scoreReason || 'Aucune analyse disponible.'}
                        </div>

                        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: prospect.generatedBody ? '0.75rem' : 0 }}>
                          {prospect.email && <a href={`mailto:${prospect.email}`} style={{ color: '#22c55e', textDecoration: 'none', fontSize: '0.8rem' }}>Email</a>}
                          {prospect.instagram && <a href={prospect.instagram} target="_blank" rel="noopener noreferrer" style={{ color: '#e879f9', textDecoration: 'none', fontSize: '0.8rem' }}>Instagram</a>}
                          {prospect.tiktok && <a href={prospect.tiktok} target="_blank" rel="noopener noreferrer" style={{ color: '#f472b6', textDecoration: 'none', fontSize: '0.8rem' }}>TikTok</a>}
                          {prospect.twitch && <a href={prospect.twitch} target="_blank" rel="noopener noreferrer" style={{ color: '#9146FF', textDecoration: 'none', fontSize: '0.8rem' }}>Twitch</a>}
                          {prospect.website && <a href={prospect.website} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.8rem' }}>Site</a>}
                          {prospect.channelUrl && <a href={prospect.channelUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.8rem' }}>YouTube</a>}
                        </div>

                        {prospect.generatedBody && (
                          <div style={{ background: 'rgba(10,8,18,0.55)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.8rem' }}>
                            <div style={{ color: '#F0EDF8', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.45rem' }}>{prospect.generatedSubject}</div>
                            <div style={{ color: '#C4BCDF', whiteSpace: 'pre-wrap', fontSize: '0.82rem', lineHeight: 1.6 }}>{prospect.generatedBody}</div>
                            <div style={{ marginTop: '0.7rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                              <div>
                                <span style={{
                                  color: prospect.sendStatus === 'Envoyé' || prospect.sendStatus === 'Brouillon créé' ? '#22c55e' : prospect.sendStatus === 'Erreur' ? '#ef4444' : '#A89FCC',
                                  fontSize: '0.76rem',
                                  fontWeight: 800,
                                }}>
                                  {prospect.sendStatus || 'Non envoyé'}
                                </span>
                                {prospect.sentAt && (
                                  <span style={{ display: 'block', color: '#6B5F96', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                                    Envoyé le {formatDate(prospect.sentAt)}
                                  </span>
                                )}
                                {prospect.sendError && (
                                  <span style={{ display: 'block', color: '#ef4444', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                                    {prospect.sendError}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                                <button onClick={() => copyMessage(prospect)} className="btn btn-secondary">Copier</button>
                                {prospect.email ? (
                                  <button
                                    onClick={() => sendCampaignMessages([prospect.id])}
                                    disabled={sendingProspectIds.includes(prospect.id) || prospect.sendStatus === 'Envoyé'}
                                    className="btn btn-secondary"
                                  >
                                    {sendingProspectIds.includes(prospect.id)
                                      ? <span className="button-loader"><span className="app-spinner" /> Envoi...</span>
                                      : prospect.sendStatus === 'Envoyé' ? 'Déjà envoyé' : 'Envoyer'}
                                  </button>
                                ) : (
                                  <span style={{ color: '#eab308', fontSize: '0.75rem', alignSelf: 'center' }}>Aucun email disponible.</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
