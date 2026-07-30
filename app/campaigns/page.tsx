'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLoader from '@/components/AppLoader'
import EmptyState from '@/components/EmptyState'
import Toast, { useToast } from '@/components/Toast'
import ProGate from '@/components/ProGate'
import { isPro } from '@/lib/plan'

type CampaignSummaryProspect = {
  channelId: string
  email: string | null
  generatedBody: string | null
  sendStatus: string | null
  sendError: string | null
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
  sendStatus: string
  sentAt: string | null
  sendError: string | null
  gmailMessageId: string | null
  createdAt: string
}

type CampaignDetails = Omit<CampaignSummary, 'prospects'> & {
  prospects: CampaignProspect[]
}

type GmailStatus = {
  connected: boolean
  email: string | null
  sendMode?: 'draft' | 'send'
}

type DraftMessage = {
  subject: string
  body: string
}

type SendSummary = {
  successCount: number
  failureCount: number
  skippedNoEmailCount: number
  skippedIncompleteCount: number
  skippedAlreadyProcessedCount: number
  skippedNotFoundCount: number
  mode?: 'draft' | 'send'
  results?: Array<{ prospectId: string; success: boolean; status: string; error?: string }>
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

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'YT'
}

function isValidUrl(value: string | null) {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function hasValidEmail(email: string | null) {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
}

function hasCompleteMessage(prospect: CampaignProspect) {
  return Boolean(prospect.generatedSubject?.trim() && prospect.generatedBody?.trim())
}

function isAlreadyProcessed(prospect: CampaignProspect) {
  return prospect.sendStatus === 'Envoyé' || prospect.sendStatus === 'Brouillon créé'
}

function isSendEligible(prospect: CampaignProspect) {
  return hasValidEmail(prospect.email) && hasCompleteMessage(prospect) && !isAlreadyProcessed(prospect)
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
  const withoutEmail = total - withEmail
  const messagesReady = prospects.filter(prospect => Boolean(prospect.generatedBody)).length
  const sent = prospects.filter(prospect => prospect.sendStatus === 'Envoyé' || prospect.sendStatus === 'Brouillon créé').length
  const errors = prospects.filter(prospect => prospect.sendStatus === 'Erreur' || Boolean(prospect.sendError)).length

  let status = 'Brouillon'
  if (total === 0) status = 'Brouillon'
  else if (sent === total) status = 'Envoyée'
  else if (sent > 0 && (errors > 0 || sent < total)) status = 'Partiellement envoyée'
  else if (errors > 0) status = 'Erreur'
  else if (messagesReady > 0 && messagesReady === withEmail && withEmail > 0) status = 'Prête à envoyer'
  else if (messagesReady > 0) status = 'À préparer'
  else status = 'À préparer'

  return { total, withEmail, withoutEmail, messagesReady, sent, errors, status }
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
  return [
    prospect.channelUrl && isValidUrl(prospect.channelUrl) ? { label: 'Voir la chaîne YouTube', href: prospect.channelUrl } : null,
    prospect.instagram && isValidUrl(prospect.instagram) ? { label: 'Ouvrir Instagram', href: prospect.instagram } : null,
    prospect.tiktok && isValidUrl(prospect.tiktok) ? { label: 'Ouvrir TikTok', href: prospect.tiktok } : null,
    prospect.twitch && isValidUrl(prospect.twitch) ? { label: 'Ouvrir Twitch', href: prospect.twitch } : null,
    prospect.website && isValidUrl(prospect.website) ? { label: 'Ouvrir le site', href: prospect.website } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>
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
  const [generatingIds, setGeneratingIds] = useState<string[]>([])
  const [savingIds, setSavingIds] = useState<string[]>([])
  const [sendingProspectIds, setSendingProspectIds] = useState<string[]>([])
  const [newCampaignName, setNewCampaignName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [scoreFilter, setScoreFilter] = useState('Tous')
  const [selectedProspectIds, setSelectedProspectIds] = useState<string[]>([])
  const [draftMessages, setDraftMessages] = useState<Record<string, DraftMessage>>({})
  const [gmail, setGmail] = useState<GmailStatus | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [sendSummary, setSendSummary] = useState<SendSummary | null>(null)
  const { toast, showToast } = useToast()
  const plan = (session?.user as any)?.plan || 'Gratuit'
  const canUseCampaigns = isPro(plan)

  const overview = useMemo(() => {
    const campaignCount = campaigns.length
    const prospectCount = campaigns.reduce((sum, campaign) => sum + (campaign._count?.prospects || campaign.prospects?.length || 0), 0)
    const readyCount = campaigns.filter(campaign => getCampaignRollup(campaign.prospects || []).status === 'Prête à envoyer').length
    const sentCount = campaigns.filter(campaign => ['Envoyée', 'Partiellement envoyée'].includes(getCampaignRollup(campaign.prospects || []).status)).length

    return { campaignCount, prospectCount, readyCount, sentCount }
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
  const manualProspects = (selectedCampaign?.prospects || []).filter(prospect => !hasValidEmail(prospect.email))

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('gmail')
    if (!result) return

    if (result === 'connected') showToast('Gmail connecté avec succès.')
    else if (result === 'cancelled') showToast('Autorisation Gmail annulée.', 'info')
    else showToast('La connexion Gmail a échoué. Réessayez.', 'error')

    window.history.replaceState({}, '', '/campaigns')
  }, [showToast])

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

  const loadGmailStatus = async () => {
    const res = await fetch('/api/gmail')
    const data = await res.json().catch(() => ({}))
    if (res.ok) setGmail(data)
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    if (!canUseCampaigns) {
      setLoading(false)
      return
    }

    Promise.all([loadCampaigns(), loadGmailStatus()]).finally(() => setLoading(false))
  }, [status, canUseCampaigns])

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
      showToast(data.error || 'Impossible de charger la campagne.', 'error')
      return
    }

    setSelectedCampaign(data.campaign)
    setSendSummary(null)
    if (!preserveSelection) setSelectedProspectIds([])
  }

  const refreshSelectedCampaign = async (preserveSelection = true) => {
    if (!selectedCampaign) return
    await Promise.all([openCampaign(selectedCampaign.id, preserveSelection), loadCampaigns()])
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

  const saveProspectMessage = async (prospectId: string) => {
    if (!selectedCampaign) return
    const draft = draftMessages[prospectId]
    if (!draft?.subject.trim() || !draft?.body.trim()) {
      showToast('Sujet et message sont requis.', 'info')
      return
    }

    setSavingIds(current => [...current, prospectId])
    const res = await fetch(`/api/campaigns/${selectedCampaign.id}/prospects/${prospectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generatedSubject: draft.subject,
        generatedBody: draft.body,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setSavingIds(current => current.filter(id => id !== prospectId))

    if (!res.ok) {
      showToast(data.error || 'Impossible de sauvegarder le message.', 'error')
      return
    }

    await refreshSelectedCampaign(true)
    showToast('Message sauvegardé')
  }

  const generateCampaignEmails = async (ids = selectedProspectIds) => {
    if (!selectedCampaign) return
    if (!canUseCampaigns) return showToast('Le plan Pro est requis pour générer des messages IA en campagne.', 'info')
    if (ids.length === 0) return showToast('Sélectionnez au moins un prospect à générer.', 'info')

    setGeneratingIds(ids)
    const res = await fetch(`/api/campaigns/${selectedCampaign.id}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectIds: ids, overwrite: true }),
    })
    const data = await res.json().catch(() => ({}))
    setGeneratingIds([])

    if (!res.ok) {
      if (data.upgrade) return showToast('Plan Pro requis pour les campagnes IA.', 'info')
      return showToast(data.error || 'Impossible de générer les messages.', 'error')
    }

    await refreshSelectedCampaign(true)
    showToast(data.generatedCount > 0 ? `${data.generatedCount} message${data.generatedCount > 1 ? 's' : ''} généré${data.generatedCount > 1 ? 's' : ''}` : data.message || 'Aucun message généré.', data.generatedCount > 0 ? 'success' : 'info')
  }

  const copyMessage = async (prospect: CampaignProspect) => {
    const draft = draftMessages[prospect.id]
    const message = [draft?.subject ? `Objet: ${draft.subject}` : '', draft?.body || '']
      .filter(Boolean)
      .join('\n\n')
    if (!message) return

    await navigator.clipboard.writeText(message)
    showToast('Message copié')
  }

  const sendCampaignMessages = async (prospectIds: string[]) => {
    if (!selectedCampaign || prospectIds.length === 0) {
      showToast('Sélectionnez au moins un prospect.', 'info')
      return
    }

    const selectedProspects = selectedCampaign.prospects.filter(prospect => prospectIds.includes(prospect.id))
    const eligibleCount = selectedProspects.filter(isSendEligible).length
    if (eligibleCount === 0) {
      showToast('Aucun prospect éligible : vérifiez email, sujet et message.', 'info')
      return
    }

    if (!gmail?.connected) {
      showToast('Connectez Gmail pour envoyer cette campagne.', 'info')
      return
    }

    const modeText = gmail.sendMode === 'send' ? 'envoyer' : 'créer des brouillons pour'
    if (!window.confirm(`Confirmer et ${modeText} ${eligibleCount} prospect${eligibleCount > 1 ? 's' : ''} ?`)) return

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

    setSendSummary(data)
    await refreshSelectedCampaign(true)

    if (data.successCount === 0) {
      showToast('Aucun email envoyé.', 'info')
      return
    }

    const action = data.mode === 'send' ? 'envoyé' : 'créé en brouillon'
    const skipped = (data.skippedNoEmailCount || 0) + (data.skippedIncompleteCount || 0) + (data.failureCount || 0)
    showToast(`${data.successCount} message${data.successCount > 1 ? 's' : ''} ${action}${data.successCount > 1 ? 's' : ''}${skipped ? ` · ${skipped} à vérifier` : ''}`)
  }

  const toggleSelectedProspect = (prospectId: string) => {
    setSelectedProspectIds(current =>
      current.includes(prospectId)
        ? current.filter(id => id !== prospectId)
        : [...current, prospectId]
    )
  }

  const selectAllVisible = () => {
    setSelectedProspectIds(current => Array.from(new Set([...current, ...filteredProspects.map(prospect => prospect.id)])))
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
      <nav className="app-nav" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,8,18,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(83,58,183,0.2)', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <Link href="/dashboard/home" style={{ textDecoration: 'none' }}>
          <div className="font-display" style={{ fontWeight: 800, fontSize: '1.2rem', color: '#F0EDF8' }}>
            Prospect<span className="grad-text">Tube</span>
          </div>
        </Link>
        <div className="app-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard/home" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>Accueil</Link>
          <Link href="/dashboard" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>Nouvelle recherche</Link>
          <Link href="/favorites" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>Mes favoris</Link>
          <Link href="/history" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>Historique</Link>
          <Link href="/campaigns" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.85rem' }}>Campagnes</Link>
          <Link href="/settings" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.85rem' }}>Paramètres</Link>
          <div style={{ background: 'rgba(83,58,183,0.2)', border: '1px solid rgba(83,58,183,0.4)', color: '#a78bfa', padding: '0.2rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 500 }}>
            Plan {plan}
          </div>
          <button onClick={() => signOut({ callbackUrl: '/' })} style={{ background: 'none', border: '1px solid rgba(83,58,183,0.3)', color: '#A89FCC', padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
            Déconnexion
          </button>
        </div>
      </nav>

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
                Regroupez vos créateurs, préparez un message manuel ou IA, puis créez les brouillons Gmail uniquement pour les prospects éligibles.
              </p>
            </div>
            <button onClick={() => setShowGuide(true)} className="btn btn-secondary">Voir le guide</button>
          </div>

          {showGuide && (
            <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem', border: '1px solid rgba(167,139,250,0.24)', background: 'linear-gradient(135deg, rgba(83,58,183,0.18), rgba(255,255,255,0.035))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', marginBottom: '0.85rem' }}>
                <div>
                  <div style={{ color: '#F0EDF8', fontWeight: 800, marginBottom: '0.25rem' }}>Guide rapide</div>
                  <div style={{ color: '#A89FCC', fontSize: '0.85rem' }}>Un parcours simple en sept étapes, sans bloquer votre travail.</div>
                </div>
                <button onClick={dismissGuide} aria-label="Fermer le guide campagnes" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#A89FCC', borderRadius: '8px', padding: '0.35rem 0.55rem', cursor: 'pointer' }}>Fermer</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.65rem' }}>
                {['Rechercher des créateurs', 'Ajouter à une campagne', 'Rédiger ou générer', 'Connecter Gmail', 'Vérifier la sélection', 'Lancer la campagne', 'Suivre les résultats'].map((step, index) => (
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
              ['Prêtes à envoyer', overview.readyCount],
              ['Déjà lancées', overview.sentCount],
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
                              {rollup.total} prospects · {rollup.withEmail} avec email · {rollup.withoutEmail} sans email
                            </div>
                            <div style={{ color: '#6B5F96', fontSize: '0.75rem', marginTop: '0.25rem' }}>{formatDate(campaign.updatedAt || campaign.createdAt)}</div>
                          </div>
                          <span style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.22)', borderRadius: '999px', padding: '0.2rem 0.55rem', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{rollup.status}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem', marginTop: '0.75rem' }}>
                          {[
                            ['Messages', rollup.messagesReady],
                            ['Envoyés', rollup.sent],
                            ['Erreurs', rollup.errors],
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
                  Ouvrez une campagne pour préparer les messages, sélectionner les prospects éligibles et lancer les brouillons Gmail.
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
                      <button onClick={selectAllVisible} disabled={filteredProspects.length === 0} className="btn btn-secondary">Tout sélectionner</button>
                      <button onClick={deselectAll} disabled={selectedProspectIds.length === 0} className="btn btn-secondary">Tout désélectionner</button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem', border: '1px solid rgba(56,189,248,0.22)', borderRadius: '12px', background: 'rgba(56,189,248,0.07)', padding: '0.85rem 1rem', color: '#9CB8C8', fontSize: '0.82rem', lineHeight: 1.6 }}>
                    Les emails seront envoyés uniquement aux prospects avec email valide, sujet et message prêts. Pour les autres créateurs, utilisez les réseaux sociaux ou le site renseignés dans leur fiche.
                  </div>

                  {!gmail?.connected ? (
                    <div style={{ marginBottom: '1rem', border: '1px solid rgba(234,179,8,0.22)', borderRadius: '12px', background: 'rgba(234,179,8,0.07)', padding: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ color: '#F0EDF8', fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.25rem' }}>Gmail n'est pas connecté</div>
                        <div style={{ color: '#D8C896', fontSize: '0.8rem', lineHeight: 1.55 }}>Connectez Gmail pour créer les brouillons ou envoyer les messages de cette campagne.</div>
                      </div>
                      <button onClick={() => window.location.assign('/api/gmail/connect')} className="btn-primary" style={{ padding: '0.65rem 1rem', fontSize: '0.84rem' }}>Connecter Gmail</button>
                    </div>
                  ) : (
                    <div style={{ marginBottom: '1rem', border: '1px solid rgba(34,197,94,0.22)', borderRadius: '12px', background: 'rgba(34,197,94,0.07)', padding: '0.75rem 1rem', color: '#86efac', fontSize: '0.8rem', fontWeight: 800 }}>
                      Gmail connecté{gmail.email ? ` : ${gmail.email}` : ''} · Mode {gmail.sendMode === 'send' ? 'envoi réel' : 'brouillon'}
                    </div>
                  )}

                  {campaignStats && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: '0.55rem', marginBottom: '1rem' }}>
                      {[
                        ['Prospects', campaignStats.total],
                        ['Avec email', campaignStats.withEmail],
                        ['Sans email', campaignStats.withoutEmail],
                        ['Score moyen', `${campaignStats.averageScore}/100`],
                        ['Messages prêts', campaignStats.messagesReady],
                        ['Envoyés', campaignStats.sent],
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.65rem', marginBottom: '1rem' }}>
                    <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Rechercher nom, email ou score..." />
                    <select value={scoreFilter} onChange={event => setScoreFilter(event.target.value)} style={{ minWidth: '150px' }}>
                      {['Tous', 'Excellent', 'Bon', 'Moyen', 'Faible', 'Sans email'].map(filter => <option key={filter} value={filter}>{filter}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <button onClick={() => generateCampaignEmails()} disabled={generatingIds.length > 0 || selectedProspectIds.length === 0 || sendingProspectIds.length > 0} className="btn-primary" style={{ padding: '0.65rem 1rem', fontSize: '0.85rem' }}>
                      {generatingIds.length > 0 ? <span className="button-loader"><span className="app-spinner" /> Génération...</span> : `Générer avec l'IA (${selectedProspectIds.length})`}
                    </button>
                    <button onClick={() => sendCampaignMessages(selectedProspectIds)} disabled={sendingProspectIds.length > 0 || selectedProspectIds.length === 0 || !gmail?.connected} className="btn btn-secondary">
                      {sendingProspectIds.length > 0 ? <span className="button-loader"><span className="app-spinner" /> Envoi...</span> : `Envoyer la sélection (${Math.min(selectedProspectIds.length, 20)})`}
                    </button>
                  </div>

                  {sendSummary && (
                    <div style={{ marginBottom: '1rem', border: '1px solid rgba(167,139,250,0.22)', borderRadius: '12px', background: 'rgba(167,139,250,0.07)', padding: '1rem' }}>
                      <div style={{ color: '#F0EDF8', fontWeight: 900, marginBottom: '0.45rem' }}>
                        {sendSummary.successCount > 0 && sendSummary.failureCount === 0 && sendSummary.skippedNoEmailCount === 0 && sendSummary.skippedIncompleteCount === 0 ? 'Envoyée' : sendSummary.successCount > 0 ? 'Partiellement envoyée' : 'Aucun email envoyé'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', color: '#C4BCDF', fontSize: '0.82rem' }}>
                        <span>{sendSummary.successCount} envoyé{sendSummary.successCount > 1 ? 's' : ''}</span>
                        <span>{sendSummary.failureCount} échec{sendSummary.failureCount > 1 ? 's' : ''}</span>
                        <span>{sendSummary.skippedNoEmailCount} sans email</span>
                        <span>{sendSummary.skippedIncompleteCount} message incomplet</span>
                      </div>
                      {(sendSummary.results || []).filter(result => result.error).length > 0 && (
                        <div style={{ marginTop: '0.7rem', display: 'grid', gap: '0.25rem' }}>
                          {(sendSummary.results || []).filter(result => result.error).slice(0, 6).map(result => (
                            <div key={result.prospectId} style={{ color: '#ef4444', fontSize: '0.76rem' }}>{result.error}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

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
                      {filteredProspects.map(prospect => {
                        const draft = draftMessages[prospect.id] || { subject: '', body: '' }
                        const links = externalLinks(prospect)
                        const selected = selectedProspectIds.includes(prospect.id)
                        const eligible = isSendEligible(prospect)
                        return (
                          <div key={prospect.id} style={{ border: selected ? '1px solid rgba(167,139,250,0.65)' : '1px solid rgba(83,58,183,0.22)', borderRadius: '12px', padding: '0.95rem', background: 'rgba(255,255,255,0.025)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', marginBottom: '0.75rem' }}>
                              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start', minWidth: 0 }}>
                                <input type="checkbox" checked={selected} onChange={() => toggleSelectedProspect(prospect.id)} aria-label={`Sélectionner ${prospect.name}`} style={{ marginTop: '0.35rem', accentColor: '#7B63D3', cursor: 'pointer' }} />
                                {prospect.thumbnail ? (
                                  <img src={prospect.thumbnail} alt={`Photo de ${prospect.name}`} style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(83,58,183,0.35)', flexShrink: 0 }} />
                                ) : (
                                  <div aria-hidden="true" style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'rgba(83,58,183,0.2)', border: '2px solid rgba(83,58,183,0.35)', color: '#a78bfa', display: 'grid', placeItems: 'center', fontWeight: 900, flexShrink: 0 }}>{prospect.avatar || getInitials(prospect.name)}</div>
                                )}
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ color: '#F0EDF8', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>{prospect.name}</div>
                                  <div style={{ color: '#A89FCC', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                    {prospect.scoreLabel || 'Score inconnu'} · {prospect.score || 0}/100
                                  </div>
                                  <div style={{ color: '#C4BCDF', fontSize: '0.78rem', marginTop: '0.35rem', lineHeight: 1.5 }}>{prospect.scoreReason || 'Aucune analyse disponible.'}</div>
                                </div>
                              </div>
                              <span style={{ color: eligible ? '#22c55e' : isAlreadyProcessed(prospect) ? '#a78bfa' : '#eab308', background: eligible ? 'rgba(34,197,94,0.12)' : isAlreadyProcessed(prospect) ? 'rgba(167,139,250,0.12)' : 'rgba(234,179,8,0.12)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '0.22rem 0.6rem', fontSize: '0.75rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                {eligible ? 'Éligible' : isAlreadyProcessed(prospect) ? prospect.sendStatus : !hasValidEmail(prospect.email) ? 'Contact manuel' : !hasCompleteMessage(prospect) ? 'Message incomplet' : prospect.status}
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                              {prospect.email && <a href={`mailto:${prospect.email}`} style={{ color: '#22c55e', textDecoration: 'none', fontSize: '0.8rem' }}>Email</a>}
                              {links.map(link => (
                                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.8rem' }}>{link.label.replace('Ouvrir ', '').replace('Voir la chaîne YouTube', 'YouTube')}</a>
                              ))}
                            </div>

                            <div style={{ display: 'grid', gap: '0.6rem' }}>
                              <label style={{ color: '#F0EDF8', fontSize: '0.78rem', fontWeight: 800 }}>
                                Sujet
                                <input value={draft.subject} onChange={event => updateDraft(prospect.id, 'subject', event.target.value)} placeholder="Sujet de l'email" style={{ marginTop: '0.35rem', width: '100%' }} />
                              </label>
                              <label style={{ color: '#F0EDF8', fontSize: '0.78rem', fontWeight: 800 }}>
                                Message
                                <textarea value={draft.body} onChange={event => updateDraft(prospect.id, 'body', event.target.value)} placeholder="Rédigez le message ou générez-le avec l'IA." rows={5} style={{ marginTop: '0.35rem', width: '100%', resize: 'vertical' }} />
                              </label>
                            </div>

                            <div style={{ marginTop: '0.7rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                              <div>
                                <span style={{ color: prospect.sendStatus === 'Envoyé' || prospect.sendStatus === 'Brouillon créé' ? '#22c55e' : prospect.sendStatus === 'Erreur' ? '#ef4444' : '#A89FCC', fontSize: '0.76rem', fontWeight: 800 }}>
                                  {prospect.sendStatus || 'Non envoyé'}
                                </span>
                                {prospect.sentAt && (
                                  <span style={{ display: 'block', color: '#6B5F96', fontSize: '0.7rem', marginTop: '0.2rem' }}>Envoyé le {formatDate(prospect.sentAt)}</span>
                                )}
                                {prospect.sendError && (
                                  <span style={{ display: 'block', color: '#ef4444', fontSize: '0.7rem', marginTop: '0.2rem' }}>{prospect.sendError}</span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                                <button onClick={() => generateCampaignEmails([prospect.id])} disabled={generatingIds.includes(prospect.id) || sendingProspectIds.length > 0} className="btn btn-secondary">
                                  {generatingIds.includes(prospect.id) ? 'Génération...' : 'Générer avec l’IA'}
                                </button>
                                <button onClick={() => saveProspectMessage(prospect.id)} disabled={savingIds.includes(prospect.id)} className="btn btn-secondary">
                                  {savingIds.includes(prospect.id) ? 'Sauvegarde...' : 'Enregistrer'}
                                </button>
                                <button onClick={() => copyMessage(prospect)} disabled={!draft.body.trim()} className="btn btn-secondary">Copier</button>
                                <button onClick={() => sendCampaignMessages([prospect.id])} disabled={sendingProspectIds.includes(prospect.id) || !eligible || !gmail?.connected} className="btn btn-secondary">
                                  {sendingProspectIds.includes(prospect.id) ? 'Envoi...' : isAlreadyProcessed(prospect) ? 'Déjà traité' : 'Envoyer'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div style={{ marginTop: '1rem', border: '1px solid rgba(234,179,8,0.22)', borderRadius: '12px', background: 'rgba(234,179,8,0.06)', padding: '1rem' }}>
                    <div style={{ color: '#F0EDF8', fontWeight: 900, marginBottom: '0.35rem' }}>Prospects à contacter manuellement</div>
                    <p style={{ color: '#D8C896', fontSize: '0.82rem', lineHeight: 1.55, marginTop: 0 }}>
                      Ces créateurs n'ont pas d'email valide dans la campagne. Contactez-les manuellement via les liens disponibles.
                    </p>
                    {manualProspects.length === 0 ? (
                      <div style={{ color: '#A89FCC', fontSize: '0.82rem' }}>Aucun prospect sans email dans cette campagne.</div>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.55rem' }}>
                        {manualProspects.map(prospect => {
                          const links = externalLinks(prospect)
                          return (
                            <div key={prospect.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', background: 'rgba(10,8,18,0.42)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.7rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                                {prospect.thumbnail ? (
                                  <img src={prospect.thumbnail} alt={`Photo de ${prospect.name}`} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                  <div aria-hidden="true" style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(83,58,183,0.2)', color: '#a78bfa', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 900 }}>{prospect.avatar || getInitials(prospect.name)}</div>
                                )}
                                <div style={{ color: '#F0EDF8', fontWeight: 800, fontSize: '0.86rem' }}>{prospect.name}</div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {links.length === 0 ? (
                                  <span style={{ color: '#A89FCC', fontSize: '0.78rem' }}>Aucun lien public.</span>
                                ) : links.map(link => (
                                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textDecoration: 'none', fontSize: '0.76rem' }}>{link.label}</a>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
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
