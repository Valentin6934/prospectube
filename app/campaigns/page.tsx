'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppLoader from '@/components/AppLoader'
import EmptyState from '@/components/EmptyState'
import Toast, { useToast } from '@/components/Toast'
import ProGate from '@/components/ProGate'
import MainAppNav from '@/components/MainAppNav'
import ProspectPresentation from '@/components/ProspectPresentation'
import ProspectScoreExplanation from '@/components/ProspectScoreExplanation'
import { isPro } from '@/lib/plan'
import { buildCampaignDetailUrl, getCampaignFromApiResponse } from '@/lib/campaignClient'
import { normalizeCampaignMessage } from '@/lib/campaignWorkflow'
import { buildClipboardMessage, buildGmailComposeUrl, buildMailtoUrl, normalizeRecipient } from '@/lib/emailHandoff'
import { getContactChannels } from '@/lib/contactChannels'

type CampaignSummaryProspect = {
  channelId: string
  email: string | null
  instagram?: string | null
  tiktok?: string | null
  facebook?: string | null
  twitter?: string | null
  twitch?: string | null
  website?: string | null
  generatedBody: string | null
}

type CampaignSummary = {
  id: string
  name: string
  status: string
  createdAt: string
  updatedAt: string
  _count?: { prospects: number }
  prospects?: CampaignSummaryProspect[]
}

type CampaignProspect = {
  id: string
  channelId: string
  name: string
  email: string | null
  instagram: string | null
  tiktok: string | null
  facebook: string | null
  twitter: string | null
  twitch: string | null
  website: string | null
  channelUrl: string | null
  avatar: string | null
  thumbnail: string | null
  score: number | null
  scoreLabel: string | null
  scoreReason: string | null
  generatedSubject: string | null
  generatedBody: string | null
  status: string
  createdAt: string
}

type CampaignDetails = Omit<CampaignSummary, 'prospects'> & {
  prospects: CampaignProspect[]
}

type DraftMessage = {
  subject: string
  body: string
}

const ONBOARDING_KEY = 'prospecttube-campaign-onboarding-v1'

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function hasValidEmail(email: string | null) {
  return Boolean(normalizeRecipient(email))
}

function hasCompleteMessage(prospect: CampaignProspect) {
  return Boolean(prospect.generatedSubject?.trim() && prospect.generatedBody?.trim())
}

function getScoreBucket(prospect: Pick<CampaignProspect, 'score' | 'scoreLabel'>) {
  const label = `${prospect.scoreLabel || ''} ${prospect.score || ''}`.toLowerCase()
  const score = prospect.score || 0
  if (label.includes('exceptionnel') || label.includes('excellent') || score >= 80) return 'Excellent'
  if (label.includes('bon') || score >= 65) return 'Bon'
  if (label.includes('moyen') || score >= 50) return 'Moyen'
  return 'Faible'
}

function getCampaignRollup(prospects: CampaignSummaryProspect[] | CampaignProspect[] = []) {
  const total = prospects.length
  const withEmail = prospects.filter(prospect => Boolean(prospect.email)).length
  const contactable = prospects.filter(prospect => getContactChannels(prospect).length > 0).length
  const withoutEmail = total - withEmail
  const messagesReady = prospects.filter(prospect => Boolean(prospect.generatedBody)).length

  let status = 'Brouillon'
  if (total === 0) status = 'Brouillon'
  else if (messagesReady > 0 && messagesReady === contactable && contactable > 0) status = 'Prête'
  else if (messagesReady > 0) status = 'À préparer'
  else status = 'À préparer'

  return { total, withEmail, contactable, withoutEmail, messagesReady, status }
}

function getDetailedStats(prospects: CampaignProspect[]) {
  const total = prospects.length
  const averageScore = total > 0 ? Math.round(prospects.reduce((sum, prospect) => sum + (prospect.score || 0), 0) / total) : 0
  return {
    ...getCampaignRollup(prospects),
    averageScore,
    excellent: prospects.filter(prospect => getScoreBucket(prospect) === 'Excellent').length,
    bon: prospects.filter(prospect => getScoreBucket(prospect) === 'Bon').length,
    moyen: prospects.filter(prospect => getScoreBucket(prospect) === 'Moyen').length,
    faible: prospects.filter(prospect => getScoreBucket(prospect) === 'Faible').length,
  }
}

function externalLinks(prospect: CampaignProspect) {
  return getContactChannels(prospect).filter(channel => channel.key !== 'email')
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
  const [savingIds, setSavingIds] = useState<string[]>([])
  const [newCampaignName, setNewCampaignName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [scoreFilter, setScoreFilter] = useState('Tous')
  const [selectedProspectIds, setSelectedProspectIds] = useState<string[]>([])
  const [draftMessages, setDraftMessages] = useState<Record<string, DraftMessage>>({})
  const [showGuide, setShowGuide] = useState(false)
  const { toast, showToast } = useToast()
  const plan = (session?.user as any)?.plan || 'Gratuit'
  const canUseCampaigns = status === 'authenticated'

  const overview = useMemo(() => {
    const campaignCount = campaigns.length
    const prospectCount = campaigns.reduce((sum, campaign) => sum + (campaign._count?.prospects || campaign.prospects?.length || 0), 0)
    const readyCount = campaigns.filter(campaign => getCampaignRollup(campaign.prospects || []).status === 'Prête').length
    return { campaignCount, prospectCount, readyCount }
  }, [campaigns])

  const filteredProspects = (selectedCampaign?.prospects || []).filter(prospect => {
    const search = searchTerm.trim().toLowerCase()
    const matchesSearch = !search || [prospect.name, prospect.email, prospect.scoreLabel]
      .some(value => (value || '').toLowerCase().includes(search))
    const matchesFilter =
      scoreFilter === 'Tous' ||
      (scoreFilter === 'Sans email' ? !prospect.email : getScoreBucket(prospect) === scoreFilter)

    return matchesSearch && matchesFilter
  })
  const campaignStats = selectedCampaign ? getDetailedStats(selectedCampaign.prospects) : null
  const emailProspects = filteredProspects.filter(prospect => hasValidEmail(prospect.email))
  const noEmailProspects = filteredProspects.filter(prospect => !hasValidEmail(prospect.email))
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    const dismissed = window.localStorage.getItem(ONBOARDING_KEY)
    setShowGuide(dismissed !== 'dismissed')
  }, [])

  useEffect(() => {
    if (!selectedCampaign) return
    const drafts = selectedCampaign.prospects.reduce<Record<string, DraftMessage>>((acc, prospect) => {
      acc[prospect.id] = {
        subject: prospect.generatedSubject || `Collaboration avec ${prospect.name}`,
        body: prospect.generatedBody || '',
      }
      return acc
    }, {})
    setDraftMessages(drafts)
  }, [selectedCampaign])

  const loadCampaigns = async () => {
    const res = await fetch('/api/campaigns')
    const data = await res.json().catch(() => ({ campaigns: [] }))
    setCampaigns(res.ok ? data.campaigns || [] : [])
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    if (!canUseCampaigns) {
      setLoading(false)
      return
    }

    loadCampaigns().finally(() => setLoading(false))
  }, [status, canUseCampaigns])

  useEffect(() => {
    const campaignId = new URLSearchParams(window.location.search).get('campaignId')
    if (status !== 'authenticated' || !canUseCampaigns || !campaignId || loading) return
    if (selectedCampaign?.id === campaignId || openingId === campaignId) return

    openCampaign(campaignId)
  }, [status, canUseCampaigns, loading, selectedCampaign?.id, openingId])

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
    showToast('Campagne créée')
  }

  const openCampaign = async (campaignId: string, preserveSelection = false) => {
    setOpeningId(campaignId)
    const res = await fetch(`/api/campaigns/${campaignId}`)
    const data = await res.json().catch(() => ({}))
    setOpeningId(null)

    if (!res.ok) {
      const message =
        res.status === 401 ? 'Connectez-vous pour ouvrir cette campagne.' :
        res.status === 403 ? 'Cette campagne est réservée au plan Pro.' :
        res.status === 404 ? 'Campagne introuvable ou inaccessible.' :
        data.error || 'Impossible de charger la campagne.'
      showToast(message, 'error')
      return
    }

    const campaign = getCampaignFromApiResponse<CampaignDetails>(data)
    if (!campaign) {
      showToast('Réponse campagne invalide.', 'error')
      return
    }

    setSelectedCampaign(campaign)
    if (!preserveSelection) setSelectedProspectIds([])
    const url = buildCampaignDetailUrl(campaignId)
    if (window.location.pathname + window.location.search !== url) {
      router.replace(url)
    }
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
    showToast('Campagne supprimée')
  }

  const saveProspectMessage = async (prospectId: string, options: { silent?: boolean } = {}): Promise<boolean> => {
    if (!selectedCampaign) return false
    const draft = draftMessages[prospectId]
    const normalized = normalizeCampaignMessage({
      subject: draft?.subject,
      body: draft?.body,
    })
    if (!normalized.subject || !normalized.body) {
      if (!options.silent) showToast('Sujet et message sont requis.', 'info')
      return false
    }

    setSavingIds(current => [...current, prospectId])
    const res = await fetch(`/api/campaigns/${selectedCampaign.id}/prospects/${prospectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: normalized.subject,
        body: normalized.body,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setSavingIds(current => current.filter(id => id !== prospectId))

    if (!res.ok) {
      if (!options.silent) showToast(data.error || 'Impossible de sauvegarder le message.', 'error')
      return false
    }

    const updatedProspect = data.prospect as CampaignProspect | undefined
    if (updatedProspect) {
      setSelectedCampaign(current => current
        ? {
            ...current,
            prospects: current.prospects.map(prospect =>
              prospect.id === prospectId ? { ...prospect, ...updatedProspect } : prospect
            ),
          }
        : current
      )
    }

    setDraftMessages(current => ({
      ...current,
      [prospectId]: {
        subject: updatedProspect?.generatedSubject || normalized.subject,
        body: updatedProspect?.generatedBody || normalized.body,
      },
    }))

    if (!options.silent) showToast('Message sauvegarde')
    return true
  }



  const copyMessage = async (prospect: CampaignProspect) => {
    const draft = draftMessages[prospect.id]
    const message = buildClipboardMessage({ email: prospect.email, subject: draft?.subject, body: draft?.body })
    if (!message) return

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = message
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        textarea.remove()
      }
      showToast('Message copié')
    } catch {
      showToast('Impossible de copier le message.', 'error')
    }
  }

  const openEmailHandoff = async (prospect: CampaignProspect, target: 'gmail' | 'mailto') => {
    const draft = draftMessages[prospect.id]
    const input = { email: prospect.email, subject: draft?.subject, body: draft?.body }
    const url = target === 'gmail' ? buildGmailComposeUrl(input) : buildMailtoUrl(input)
    if (!url) {
      showToast("Aucune adresse email disponible pour ce prospect.", 'info')
      return
    }

    if (hasCompleteMessage({ ...prospect, generatedSubject: draft?.subject || '', generatedBody: draft?.body || '' })) {
      await saveProspectMessage(prospect.id, { silent: true })
    }

    if (target === 'mailto') {
      window.location.assign(url)
      return
    }

    const popup = window.open(url, '_blank', 'noopener,noreferrer')
    if (!popup) {
      showToast("Le navigateur a bloqué l'ouverture. Utilisez votre client mail ou autorisez les pop-ups.", 'info')
    }
  }

  const toggleSelectedProspect = (prospectId: string) => {
    setSelectedProspectIds(current =>
      current.includes(prospectId)
        ? current.filter(id => id !== prospectId)
        : [...current, prospectId]
    )
  }

  const selectAllVisible = () => {
    setSelectedProspectIds(current => Array.from(new Set([...current, ...emailProspects.map(prospect => prospect.id)])))
  }

  const deselectAll = () => setSelectedProspectIds([])

  const dismissGuide = () => {
    window.localStorage.setItem(ONBOARDING_KEY, 'dismissed')
    setShowGuide(false)
  }

  const updateDraft = (prospectId: string, field: keyof DraftMessage, value: string) => {
    setDraftMessages(current => ({
      ...current,
      [prospectId]: {
        subject: current[prospectId]?.subject || '',
        body: current[prospectId]?.body || '',
        [field]: value,
      },
    }))
  }

  if (status === 'loading' || loading) return <AppLoader text="Chargement de vos campagnes..." />

  return (
    <div style={{ minHeight: '100vh', background: '#0A0812' }}>
      <MainAppNav plan={plan} active="campaigns" />

      {!canUseCampaigns ? (
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem' }}>
          <ProGate context="campaigns" />
        </div>
      ) : (
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div>
              <h1 className="font-display" style={{ fontWeight: 800, fontSize: '1.65rem', color: '#F0EDF8', marginBottom: '0.35rem' }}>Campagnes</h1>
              <p style={{ color: '#A89FCC', maxWidth: '680px', lineHeight: 1.65, margin: 0 }}>
                Regroupez vos créateurs, préparez vos messages, puis ouvrez-les dans votre messagerie quand vous êtes prêt.
              </p>
            </div>
            <button onClick={() => setShowGuide(true)} className="btn btn-secondary">Voir le guide</button>
          </div>

          {showGuide && (
            <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem', border: '1px solid rgba(167,139,250,0.24)', background: 'linear-gradient(135deg, rgba(83,58,183,0.18), rgba(255,255,255,0.035))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', marginBottom: '0.85rem' }}>
                <div>
                  <div style={{ color: '#F0EDF8', fontWeight: 800, marginBottom: '0.25rem' }}>Guide rapide</div>
                  <div style={{ color: '#A89FCC', fontSize: '0.85rem' }}>Un parcours simple, sans connecter votre boîte mail.</div>
                </div>
                <button onClick={dismissGuide} aria-label="Fermer le guide campagnes" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#A89FCC', borderRadius: '8px', padding: '0.35rem 0.55rem', cursor: 'pointer' }}>Fermer</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.65rem' }}>
                {['Rechercher des créateurs', 'Ajouter à une campagne', 'Rédiger le message', 'Vérifier le destinataire', 'Ouvrir dans sa messagerie'].map((step, index) => (
                  <div key={step} style={{ background: 'rgba(10,8,18,0.42)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem' }}>
                    <div style={{ color: '#a78bfa', fontWeight: 900, fontSize: '0.75rem', marginBottom: '0.35rem' }}>0{index + 1}</div>
                    <div style={{ color: '#F0EDF8', fontSize: '0.84rem', fontWeight: 700 }}>{step}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {[
              ['Campagnes', overview.campaignCount],
              ['Prospects', overview.prospectCount],
              ['Prêtes', overview.readyCount],
              ['Messages prêts', campaigns.reduce((sum, campaign) => sum + (campaign.prospects || []).filter(prospect => Boolean(prospect.generatedBody)).length, 0)],
            ].map(([label, value]) => (
              <div key={label} className="card" style={{ padding: '1rem' }}>
                <div style={{ color: '#6B5F96', fontSize: '0.78rem', marginBottom: '0.35rem' }}>{label}</div>
                <div style={{ color: '#F0EDF8', fontWeight: 900, fontSize: '1.25rem' }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={newCampaignName} onChange={event => setNewCampaignName(event.target.value)} placeholder="Nom de campagne" style={{ minWidth: '240px', flex: 1 }} />
              <button onClick={createCampaign} disabled={creating || !newCampaignName.trim()} className="btn-primary" style={{ padding: '0.65rem 1rem', fontSize: '0.85rem' }}>
                {creating ? <span className="button-loader"><span className="app-spinner" /> Création...</span> : 'Créer une campagne'}
              </button>
            </div>
          </div>

          <div className="campaign-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.85fr) minmax(0, 1.35fr)', gap: '1rem' }}>
            <div>
              {campaigns.length === 0 ? (
                <EmptyState
                  icon="📧"
                  title="Aucune campagne"
                  description="Créez une campagne puis ajoutez vos prospects depuis la recherche, les favoris ou l'historique."
                  actionLabel="Nouvelle recherche"
                  actionHref="/dashboard"
                />
              ) : (
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {campaigns.map(campaign => {
                    const rollup = getCampaignRollup(campaign.prospects || [])
                    return (
                      <div key={campaign.id} className="card" style={{ padding: '1rem', border: selectedCampaign?.id === campaign.id ? '1px solid rgba(167,139,250,0.5)' : undefined }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'start' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: '#F0EDF8', fontWeight: 800, marginBottom: '0.3rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{campaign.name}</div>
                            <div style={{ color: '#A89FCC', fontSize: '0.8rem' }}>
                              {rollup.total} prospects · {rollup.contactable} contactables · {rollup.withEmail} avec email
                            </div>
                            <div style={{ color: '#6B5F96', fontSize: '0.75rem', marginTop: '0.25rem' }}>{formatDate(campaign.updatedAt || campaign.createdAt)}</div>
                          </div>
                          <span style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.22)', borderRadius: '999px', padding: '0.2rem 0.55rem', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{rollup.status}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem', marginTop: '0.75rem' }}>
                          {[
                            ['Messages', rollup.messagesReady],
                            ['Contactables', rollup.contactable],
                            ['Avec email', rollup.withEmail],
                          ].map(([label, value]) => (
                            <div key={label} style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.45rem' }}>
                              <div style={{ color: '#6B5F96', fontSize: '0.68rem' }}>{label}</div>
                              <div style={{ color: '#F0EDF8', fontWeight: 800, fontSize: '0.85rem' }}>{value}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.45rem', marginTop: '0.8rem' }}>
                          <button onClick={() => openCampaign(campaign.id)} disabled={openingId === campaign.id} style={{ background: 'rgba(83,58,183,0.18)', border: '1px solid rgba(83,58,183,0.32)', color: '#a78bfa', padding: '0.55rem 0.75rem', borderRadius: '8px', cursor: openingId === campaign.id ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                            {openingId === campaign.id ? <span className="button-loader"><span className="app-spinner" /> Ouverture...</span> : 'Ouvrir la campagne'}
                          </button>
                          <button onClick={() => deleteCampaign(campaign.id)} disabled={deletingId === campaign.id} aria-label={`Supprimer ${campaign.name}`} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '0.55rem 0.65rem', borderRadius: '8px', cursor: deletingId === campaign.id ? 'default' : 'pointer', fontSize: '0.78rem' }}>
                            {deletingId === campaign.id ? '...' : 'Supprimer'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              {!selectedCampaign ? (
                <div className="card" style={{ padding: '2rem', color: '#A89FCC', textAlign: 'center', lineHeight: 1.6 }}>
                  Ouvrez une campagne pour préparer vos messages et les transmettre à votre messagerie.
                </div>
              ) : (
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <h2 className="font-display" style={{ color: '#F0EDF8', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{selectedCampaign.name}</h2>
                      <div style={{ color: '#A89FCC', fontSize: '0.82rem' }}>
                        {selectedCampaign.prospects.length} prospect{selectedCampaign.prospects.length !== 1 ? 's' : ''} · {selectedProspectIds.length} sélectionné{selectedProspectIds.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                      <button onClick={selectAllVisible} disabled={emailProspects.length === 0} className="btn btn-secondary">Tout sélectionner</button>
                      <button onClick={deselectAll} disabled={selectedProspectIds.length === 0} className="btn btn-secondary">Tout désélectionner</button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem', border: '1px solid rgba(56,189,248,0.22)', borderRadius: '12px', background: 'rgba(56,189,248,0.07)', padding: '0.85rem 1rem', color: '#9CB8C8', fontSize: '0.82rem', lineHeight: 1.6 }}>
                    ProspectTube prépare le destinataire, le sujet et le message. Vous gardez la main : l’envoi se fait ensuite depuis Gmail ou votre client mail, sans connecter votre boîte à ProspectTube.
                  </div>

                  {campaignStats && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: '0.55rem', marginBottom: '1rem' }}>
                      {[
                        ['Prospects', campaignStats.total],
                        ['Contactables', campaignStats.contactable],
                        ['Avec email', campaignStats.withEmail],
                        ['Score moyen', `${campaignStats.averageScore}/100`],
                        ['Messages prêts', campaignStats.messagesReady],
                        ['Excellent', campaignStats.excellent],
                        ['Bon', campaignStats.bon],
                      ].map(([label, value]) => (
                        <div key={label} style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.65rem' }}>
                          <div style={{ color: '#6B5F96', fontSize: '0.72rem', marginBottom: '0.2rem' }}>{label}</div>
                          <div style={{ color: '#F0EDF8', fontWeight: 800, fontSize: '0.95rem' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedCampaign.prospects.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <ProspectScoreExplanation />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.65rem', marginBottom: '1rem' }}>
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
                      {emailProspects.map(prospect => {
                        const draft = draftMessages[prospect.id] || { subject: '', body: '' }
                        const selected = selectedProspectIds.includes(prospect.id)
                        const incompleteMessage = !draft.subject.trim() || !draft.body.trim()
                        const statusLabel = incompleteMessage
                            ? 'À compléter'
                            : selected
                              ? 'Prêt'
                              : ''
                        const statusColor = incompleteMessage ? '#eab308' : '#22c55e'
                        const statusBg = incompleteMessage ? 'rgba(234,179,8,0.10)' : 'rgba(34,197,94,0.12)'
                        return (
                          <div key={prospect.id} className="prospect-card campaign-prospect-card" style={{ border: selected ? '1px solid rgba(167,139,250,0.65)' : '1px solid rgba(83,58,183,0.24)', borderRadius: '12px', padding: '1rem', background: selected ? 'linear-gradient(135deg, rgba(83,58,183,0.18), rgba(255,255,255,0.035))' : 'rgba(255,255,255,0.03)', boxShadow: '0 16px 40px rgba(0,0,0,0.16)', width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                            <div className="campaign-prospect-header">
                              <input type="checkbox" checked={selected} onChange={() => toggleSelectedProspect(prospect.id)} aria-label={`Sélectionner ${prospect.name}`} style={{ marginTop: '0.35rem', accentColor: '#7B63D3', cursor: 'pointer', flexShrink: 0 }} />
                              <ProspectPresentation
                                channel={prospect}
                                compact
                                selected={selected}
                                rightSlot={statusLabel ? (
                                  <span style={{ color: statusColor, background: statusBg, border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '0.22rem 0.6rem', fontSize: '0.75rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                    {statusLabel}
                                  </span>
                                ) : null}
                              />
                            </div>
                            <div className="campaign-score-reason">{prospect.scoreReason || 'Aucune analyse disponible.'}</div>

                            <div className="campaign-message-editor">
                              <label style={{ color: '#F0EDF8', fontSize: '0.78rem', fontWeight: 800 }}>
                                Sujet
                                <input value={draft.subject} onChange={event => updateDraft(prospect.id, 'subject', event.target.value)} placeholder="Sujet de l'email" style={{ marginTop: '0.35rem', width: '100%', minWidth: 0, background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.1)' }} />
                              </label>
                              <label style={{ color: '#F0EDF8', fontSize: '0.78rem', fontWeight: 800 }}>
                                Message
                                <textarea value={draft.body} onChange={event => updateDraft(prospect.id, 'body', event.target.value)} placeholder="Rédigez votre message." rows={5} style={{ marginTop: '0.35rem', width: '100%', minWidth: 0, resize: 'vertical' }} />
                              </label>
                            </div>

                            <div className="campaign-prospect-footer">
                              <div style={{ color: '#918B9B', fontSize: '0.76rem', lineHeight: 1.45 }}>ProspectTube prépare le message. Vous le relisez et l’envoyez depuis votre messagerie.</div>
                              <div className="campaign-prospect-actions">
                                <button onClick={() => openEmailHandoff(prospect, 'gmail')} className="btn-primary">Ouvrir dans Gmail</button>
                                <button onClick={() => openEmailHandoff(prospect, 'mailto')} className="btn btn-secondary">Ouvrir dans mon client mail</button>
                                <button onClick={() => copyMessage(prospect)} disabled={!draft.subject.trim() && !draft.body.trim()} className="btn btn-secondary">Copier</button>
                                <button onClick={() => saveProspectMessage(prospect.id)} disabled={savingIds.includes(prospect.id)} className="btn btn-ghost">
                                  {savingIds.includes(prospect.id) ? 'Sauvegarde…' : 'Enregistrer'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {noEmailProspects.length > 0 && (
                    <div style={{ marginTop: '1rem', border: '1px solid rgba(234,179,8,0.22)', borderRadius: '12px', background: 'rgba(234,179,8,0.06)', padding: '1rem' }}>
                      <div style={{ color: '#F0EDF8', fontWeight: 900, marginBottom: '0.35rem' }}>Prospects sans adresse email</div>
                      <p style={{ color: '#D8C896', fontSize: '0.82rem', lineHeight: 1.55, marginTop: 0 }}>
                        Ces créateurs restent disponibles dans la campagne. Utilisez leurs réseaux sociaux ou leur site public pour les contacter.
                      </p>
                      <div style={{ display: 'grid', gap: '0.55rem' }}>
                        {noEmailProspects.map(prospect => {
                          const links = externalLinks(prospect)
                          const draft = draftMessages[prospect.id] || { subject: '', body: '' }
                          return (
                            <div key={prospect.id} style={{ display: 'grid', gap: '0.7rem', background: 'rgba(10,8,18,0.42)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.8rem', overflow: 'hidden' }}>
                              <ProspectPresentation
                                channel={prospect}
                                compact
                                rightSlot={(
                                  <span style={{ color: '#eab308', background: 'rgba(234,179,8,0.10)', border: '1px solid rgba(234,179,8,0.22)', borderRadius: '999px', padding: '0.22rem 0.6rem', fontSize: '0.75rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                    Aucune adresse email disponible
                                  </span>
                                )}
                              />
                              <div className="campaign-message-editor">
                                <label style={{ color: '#F0EDF8', fontSize: '0.78rem', fontWeight: 800 }}>
                                  Message pour DM
                                  <textarea value={draft.body} onChange={event => updateDraft(prospect.id, 'body', event.target.value)} placeholder="Rédigez un message court et personnalisé." rows={4} style={{ marginTop: '0.35rem', width: '100%', minWidth: 0, resize: 'vertical' }} />
                                </label>
                                <p style={{ margin: 0, color: '#918B9B', fontSize: '0.74rem' }}>Pour un DM, privilégiez un message plus court qu’un email.</p>
                              </div>
                              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', minWidth: 0 }}>
                                {links.length === 0 ? (
                                  <span style={{ color: '#A89FCC', fontSize: '0.78rem' }}>Aucun lien public.</span>
                                ) : links.map(link => (
                                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textDecoration: 'none', fontSize: '0.76rem' }}>Ouvrir {link.label}</a>
                                ))}
                                <button onClick={() => copyMessage(prospect)} disabled={!draft.body.trim()} className="btn btn-secondary">Copier le message</button>
                                <button onClick={() => saveProspectMessage(prospect.id)} disabled={savingIds.includes(prospect.id) || !draft.body.trim()} className="btn btn-ghost">{savingIds.includes(prospect.id) ? 'Sauvegarde…' : 'Enregistrer'}</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </div>
  )
}
