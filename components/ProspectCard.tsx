'use client'

import { useState } from 'react'
import CreatorDetails from './CreatorDetails'
import ProGate from './ProGate'
import ProspectPresentation from './ProspectPresentation'
import { buildCampaignProspectPayload, getCampaignIdFromCreateResponse } from '@/lib/campaignClient'

export type ProspectChannel = {
  id?: string
  channelId?: string
  name?: string | null
  subs?: string | null
  subsNum?: number | null
  score?: number | null
  scoreLabel?: string | null
  scoreReason?: string | null
  email?: string | null
  instagram?: string | null
  tiktok?: string | null
  facebook?: string | null
  twitter?: string | null
  twitch?: string | null
  website?: string | null
  channelUrl?: string | null
  desc?: string | null
  description?: string | null
  avatar?: string | null
  color?: string | null
  thumbnail?: string | null
  totalViews?: number | null
  viewCount?: number | null
  totalViewsFormatted?: string | null
  videoCount?: number | null
  videoCountFormatted?: string | null
  viewsPerSubscriber?: number | null
  createdAt?: string | null
  publishedAt?: string | null
  channelCreatedAt?: string | null
  recentMedianViews?: number | null
  recentViewSubscriberRatio?: number | null
  recentEngagementRate?: number | null
  publishingFrequency?: string | null
  contactability?: string | null
  contentRelevance?: number | null
  subnicheMatch?: number | null
  subnicheMatchLabel?: string | null
  matchMode?: string | null
  matchNotice?: string | null
  editingPotential?: number | null
  editingPotentialLabel?: string | null
  scoreConfidence?: string | null
  detectedLanguage?: string | null
  languageConfidence?: string | null
  lastPublishedAt?: string | null
  activityStatus?: 'ACTIVE_HIGH' | 'ACTIVE_MEDIUM' | 'ACTIVE_LOW' | 'INACTIVE' | 'LIMITED_DATA' | null
  activityLabel?: string | null
  videosLast30Days?: number | null
  videosLast90Days?: number | null
  medianPublishIntervalDays?: number | null
  scoreBreakdown?: Record<string, number> | null
  publicEmailSource?: 'channel_description' | 'video_description' | null
  publicEmailConfidence?: 'high' | 'medium' | 'low' | null
  publicEmailOccurrences?: number | null
}

type ProspectCardProps = {
  channel: ProspectChannel
  canEmail?: boolean
  isFavorite?: boolean
  favoriteLoading?: boolean
  removing?: boolean
  showFavoriteButton?: boolean
  showRemoveButton?: boolean
  canUseCampaigns?: boolean
  onGenerateEmail?: (channel: ProspectChannel) => void
  onAddFavorite?: (channel: ProspectChannel) => void
  onRemoveFavorite?: (channel: ProspectChannel) => void
}

type CampaignOption = {
  id: string
  name: string
  createdAt?: string
  updatedAt?: string
  _count?: { prospects: number }
  prospectChannelIds?: string[]
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  window.dispatchEvent(new CustomEvent('prospectube-toast', { detail: { message, type } }))
}

export default function ProspectCard({
  channel,
  canEmail = false,
  isFavorite = false,
  favoriteLoading = false,
  removing = false,
  showFavoriteButton = false,
  showRemoveButton = false,
  canUseCampaigns = true,
  onGenerateEmail,
  onAddFavorite,
  onRemoveFavorite,
}: ProspectCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [campaignModalOpen, setCampaignModalOpen] = useState(false)
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([])
  const [campaignLoading, setCampaignLoading] = useState(false)
  const [campaignError, setCampaignError] = useState('')
  const [newCampaignName, setNewCampaignName] = useState('')
  const name = channel.name || 'Chaîne inconnue'
  const channelId = channel.channelId || channel.id || ''
  const actionColumns = showRemoveButton ? 3 : showFavoriteButton && onGenerateEmail ? 4 : 3

  const openCampaignPicker = async () => {
    if (!canUseCampaigns) {
      setUpgradeOpen(true)
      return
    }

    if (!channelId) return showToast('Cette chaîne ne peut pas être ajoutée.', 'error')

    setCampaignModalOpen(true)
    setCampaignError('')
    setCampaignLoading(true)
    const listRes = await fetch('/api/campaigns')
    const listData = await listRes.json().catch(() => ({}))
    setCampaignLoading(false)

    if (!listRes.ok) {
      if (listData.upgrade) {
        setCampaignModalOpen(false)
        setUpgradeOpen(true)
        return
      }
      setCampaignError(listData.error || 'Impossible de charger les campagnes.')
      return
    }

    setCampaignOptions(listData.campaigns || [])
  }

  const addToCampaign = async (campaignId: string | 'new') => {
    if (!channelId) return showToast('Cette chaîne ne peut pas être ajoutée.', 'error')

    setCampaignLoading(true)
    setCampaignError('')
    let targetCampaignId = campaignId === 'new' ? '' : campaignId

    if (!targetCampaignId) {
      const campaignName = newCampaignName.trim()
      if (!campaignName) {
        setCampaignLoading(false)
        setCampaignError('Le nom de la campagne est requis.')
        return
      }

      const createRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: campaignName }),
      })
      const createData = await createRes.json().catch(() => ({}))
      if (!createRes.ok) {
        setCampaignLoading(false)
        if (createData.upgrade) {
          setCampaignModalOpen(false)
          setUpgradeOpen(true)
          return
        }
        setCampaignError(createData.error || 'Impossible de créer la campagne.')
        return
      }
      const createdCampaignId = getCampaignIdFromCreateResponse(createData)
      if (!createdCampaignId) {
        setCampaignLoading(false)
        setCampaignError("La campagne a été créée, mais son identifiant est introuvable.")
        return
      }
      targetCampaignId = createdCampaignId
      showToast('Campagne créée')
    }

    const addRes = await fetch(`/api/campaigns/${targetCampaignId}/prospects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCampaignProspectPayload(channel as Record<string, unknown>)),
    })
    const addData = await addRes.json().catch(() => ({}))
    setCampaignLoading(false)
    if (!addRes.ok) {
      if (addData.upgrade) {
        setCampaignModalOpen(false)
        setUpgradeOpen(true)
        return
      }
      setCampaignError(addData.error || "Impossible d'ajouter ce prospect à la campagne.")
      return
    }

    setCampaignModalOpen(false)
    setNewCampaignName('')
    showToast(
      addData.added ? 'Prospect ajouté à la campagne' : 'Ce prospect est déjà présent dans cette campagne.',
      addData.added ? 'success' : 'info'
    )
  }

  return (
    <div className="card prospect-card">
      <ProspectPresentation channel={channel} />

      <div className="prospect-actions" style={{ '--prospect-action-columns': actionColumns } as React.CSSProperties}>
        <button onClick={openCampaignPicker} className="btn-primary">
          Ajouter à une campagne
        </button>
        {showFavoriteButton && (
          <button onClick={() => onAddFavorite?.(channel)} disabled={isFavorite || favoriteLoading} className="btn btn-secondary">
            {isFavorite ? 'Favori' : favoriteLoading ? 'Ajout…' : 'Favori'}
          </button>
        )}
        {showRemoveButton && (
          <button onClick={() => onRemoveFavorite?.(channel)} disabled={removing} className="btn btn-danger">
            {removing ? 'Suppression…' : 'Supprimer'}
          </button>
        )}
        {onGenerateEmail && (
          <button onClick={() => onGenerateEmail(channel)} disabled={!canEmail} className="btn btn-secondary">
            {canEmail ? 'Préparer un message' : 'Message Pro'}
          </button>
        )}
        <button onClick={() => setDetailsOpen(true)} className="btn btn-ghost">
          Voir la fiche
        </button>
      </div>

      <CreatorDetails
        channel={channel}
        open={detailsOpen}
        canEmail={canEmail}
        isFavorite={isFavorite}
        favoriteLoading={favoriteLoading}
        removing={removing}
        showFavoriteButton={showFavoriteButton}
        showRemoveButton={showRemoveButton}
        onClose={() => setDetailsOpen(false)}
        onGenerateEmail={onGenerateEmail}
        onAddFavorite={onAddFavorite}
        onRemoveFavorite={onRemoveFavorite}
        onAddCampaign={() => openCampaignPicker()}
      />

      {campaignModalOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(0,0,0,0.72)', display: 'grid', placeItems: 'center', padding: '1rem' }} onClick={() => !campaignLoading && setCampaignModalOpen(false)}>
          <div className="modal-panel" style={{ width: '100%', maxWidth: '560px', position: 'relative' }} onClick={event => event.stopPropagation()}>
            <button aria-label="Fermer" onClick={() => setCampaignModalOpen(false)} disabled={campaignLoading} style={{ position: 'absolute', top: '0.7rem', right: '0.7rem', zIndex: 1, border: 'none', background: 'transparent', color: '#A89FCC', cursor: campaignLoading ? 'default' : 'pointer', fontSize: '1rem' }}>x</button>
            <h3 className="font-display" style={{ color: '#F0EDF8', fontSize: '1.1rem', marginBottom: '0.35rem' }}>Ajouter à une campagne</h3>
            <p style={{ color: '#A89FCC', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: '1rem' }}>Choisissez une campagne existante ou créez-en une nouvelle.</p>

            {campaignLoading && <div role="status" style={{ color: '#A89FCC', fontSize: '0.85rem', marginBottom: '0.8rem' }}>Chargement des campagnes…</div>}
            {campaignError && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: '0.8rem' }}>{campaignError}</div>}

            <div style={{ display: 'grid', gap: '0.55rem', marginBottom: '1rem' }}>
              {campaignOptions.length === 0 && !campaignLoading ? (
                <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.85rem', color: '#A89FCC', fontSize: '0.84rem' }}>Aucune campagne pour l'instant.</div>
              ) : campaignOptions.map(campaign => {
                const alreadyPresent = (campaign.prospectChannelIds || []).includes(channelId)
                return (
                  <button
                    key={campaign.id}
                    onClick={() => addToCampaign(campaign.id)}
                    disabled={campaignLoading || alreadyPresent}
                    style={{ textAlign: 'left', border: alreadyPresent ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(83,58,183,0.25)', borderRadius: '10px', padding: '0.85rem', background: alreadyPresent ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.035)', color: '#F0EDF8', cursor: campaignLoading || alreadyPresent ? 'default' : 'pointer' }}
                  >
                    <span style={{ display: 'block', fontWeight: 800 }}>{campaign.name}</span>
                    <span style={{ display: 'block', color: alreadyPresent ? '#86efac' : '#A89FCC', fontSize: '0.78rem', marginTop: '0.25rem' }}>
                      {alreadyPresent ? 'Déjà présent' : `${campaign._count?.prospects || 0} prospect${(campaign._count?.prospects || 0) !== 1 ? 's' : ''}`}
                    </span>
                  </button>
                )
              })}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
              <div style={{ color: '#F0EDF8', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Créer une nouvelle campagne</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input value={newCampaignName} onChange={event => setNewCampaignName(event.target.value)} placeholder="Nom de campagne" style={{ flex: 1, minWidth: '180px' }} />
                <button onClick={() => addToCampaign('new')} disabled={campaignLoading || !newCampaignName.trim()} className="btn-primary" style={{ padding: '0.65rem 1rem' }}>
                  {campaignLoading ? 'Ajout...' : 'Créer et ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {upgradeOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(0,0,0,0.72)', display: 'grid', placeItems: 'center', padding: '1rem' }} onClick={() => setUpgradeOpen(false)}>
          <div className="modal-panel" style={{ width: '100%', maxWidth: '560px', position: 'relative' }} onClick={event => event.stopPropagation()}>
            <button aria-label="Fermer" onClick={() => setUpgradeOpen(false)} style={{ position: 'absolute', top: '0.7rem', right: '0.7rem', zIndex: 1, border: 'none', background: 'transparent', color: '#A89FCC', cursor: 'pointer', fontSize: '1rem' }}>x</button>
            <ProGate compact />
          </div>
        </div>
      )}
    </div>
  )
}
