'use client'

import { useState } from 'react'
import CreatorDetails from './CreatorDetails'

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
  twitch?: string | null
  website?: string | null
  channelUrl?: string | null
  desc?: string | null
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
}

type ProspectCardProps = {
  channel: ProspectChannel
  canEmail?: boolean
  isFavorite?: boolean
  favoriteLoading?: boolean
  removing?: boolean
  showFavoriteButton?: boolean
  showRemoveButton?: boolean
  onGenerateEmail?: (channel: ProspectChannel) => void
  onAddFavorite?: (channel: ProspectChannel) => void
  onRemoveFavorite?: (channel: ProspectChannel) => void
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
  if (score >= 65) return { background: 'rgba(234,179,8,0.15)', color: '#eab308' }
  if (score >= 50) return { background: 'rgba(249,115,22,0.15)', color: '#f97316' }
  return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
}

export default function ProspectCard({
  channel,
  canEmail = false,
  isFavorite = false,
  favoriteLoading = false,
  removing = false,
  showFavoriteButton = false,
  showRemoveButton = false,
  onGenerateEmail,
  onAddFavorite,
  onRemoveFavorite,
}: ProspectCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const score = channel.score || 0
  const color = channel.color || '#533AB7'
  const name = channel.name || 'Chaîne inconnue'
  const avatar = channel.avatar || name.slice(0, 2).toUpperCase()
  const createdYear = getCreatedYear(channel.createdAt || channel.publishedAt || channel.channelCreatedAt)
  const contacts = [
    channel.email ? { label: '📧 Email trouvé', href: `mailto:${channel.email}`, color: '#22c55e' } : null,
    channel.instagram ? { label: '📱 Instagram', href: channel.instagram, color: '#e879f9' } : null,
    channel.tiktok ? { label: '🎵 TikTok', href: channel.tiktok, color: '#f472b6' } : null,
    channel.twitch ? { label: '🎮 Twitch', href: channel.twitch, color: '#9146FF' } : null,
    channel.website ? { label: '🌍 Site', href: channel.website, color: '#38bdf8' } : null,
  ].filter(Boolean) as { label: string; href: string; color: string }[]
  const stats = [
    `👥 ${channel.subs || formatCompactNumber(channel.subsNum || 0)}`,
    `👁 ${channel.totalViewsFormatted || formatCompactNumber(channel.totalViews || channel.viewCount || 0)}`,
    `🎬 ${channel.videoCountFormatted || formatCompactNumber(channel.videoCount || 0)}`,
    createdYear ? `📅 ${createdYear}` : null,
  ].filter(Boolean)
  const actionColumns = showRemoveButton ? 3 : showFavoriteButton && onGenerateEmail ? 4 : 3

  const addToCampaign = async (targetChannel: ProspectChannel) => {
    const channelId = targetChannel.channelId || targetChannel.id
    if (!channelId) return alert('Chaîne invalide.')

    const campaignName = window.prompt('Nom de la campagne')
    const name = campaignName?.trim()
    if (!name) return

    const listRes = await fetch('/api/campaigns')
    const listData = await listRes.json().catch(() => ({}))
    if (!listRes.ok) return alert(listData.error || 'Impossible de charger les campagnes.')

    let campaign = (listData.campaigns || []).find((item: { id: string; name: string }) => item.name.toLowerCase() === name.toLowerCase())

    if (!campaign) {
      const createRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const createData = await createRes.json().catch(() => ({}))
      if (!createRes.ok) return alert(createData.error || 'Impossible de créer la campagne.')
      campaign = createData.campaign
    }

    const addRes = await fetch(`/api/campaigns/${campaign.id}/prospects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targetChannel),
    })
    const addData = await addRes.json().catch(() => ({}))
    if (!addRes.ok) return alert(addData.error || "Impossible d'ajouter ce prospect à la campagne.")

    alert('Prospect ajouté à la campagne.')
  }

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '0.85rem', border: '1px solid rgba(83,58,183,0.24)', boxShadow: '0 16px 40px rgba(0,0,0,0.18)' }}>
      <div style={{ display: 'flex', gap: '0.9rem', minWidth: 0 }}>
        {channel.thumbnail ? (
          <img src={channel.thumbnail} alt="" style={{ width: '54px', height: '54px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(83,58,183,0.35)', flexShrink: 0 }} />
        ) : (
          <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: `${color}33`, border: `2px solid ${color}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', color, flexShrink: 0 }}>
            {avatar}
          </div>
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F0EDF8', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
            <span style={{ padding: '0.18rem 0.55rem', borderRadius: '999px', ...getScoreStyles(score), fontSize: '0.72rem', fontWeight: 700 }}>
              {channel.scoreLabel || '🔴 Faible potentiel'}
            </span>
            <span style={{ color: '#F0EDF8', fontWeight: 800, fontSize: '0.9rem' }}>{score}/100</span>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
            {stats.map(stat => (
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

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${actionColumns}, minmax(0, 1fr))`, gap: '0.55rem', marginTop: '0.9rem' }}>
        {showFavoriteButton && (
          <button onClick={() => onAddFavorite?.(channel)} disabled={isFavorite || favoriteLoading} style={{ background: isFavorite ? 'rgba(234,179,8,0.16)' : 'rgba(83,58,183,0.14)', color: isFavorite ? '#eab308' : '#A89FCC', border: '1px solid rgba(83,58,183,0.35)', padding: '0.55rem 0.65rem', borderRadius: '8px', cursor: isFavorite ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
            {isFavorite ? '⭐ Favori' : favoriteLoading ? 'Ajout...' : '☆ Favori'}
          </button>
        )}
        {showRemoveButton && (
          <button onClick={() => onRemoveFavorite?.(channel)} disabled={removing} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '0.55rem 0.65rem', borderRadius: '8px', cursor: removing ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
            {removing ? 'Suppression...' : 'Supprimer'}
          </button>
        )}
        {onGenerateEmail && (
          <button onClick={() => onGenerateEmail(channel)} style={{ background: canEmail ? 'linear-gradient(135deg, #533AB7, #7B63D3)' : 'rgba(83,58,183,0.15)', color: canEmail ? 'white' : '#6B5F96', border: '1px solid rgba(83,58,183,0.22)', padding: '0.55rem 0.65rem', borderRadius: '8px', cursor: canEmail ? 'pointer' : 'not-allowed', fontSize: '0.8rem', fontWeight: 700 }}>
            {canEmail ? '✨ Message IA' : '🔒 IA Pro'}
          </button>
        )}
        <button onClick={() => addToCampaign(channel)} style={{ background: 'rgba(83,58,183,0.14)', color: '#A89FCC', border: '1px solid rgba(83,58,183,0.35)', padding: '0.55rem 0.65rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
          Ajouter à campagne
        </button>
        <button onClick={() => setDetailsOpen(true)} style={{ background: 'rgba(255,255,255,0.04)', color: '#C4BCDF', border: '1px solid rgba(255,255,255,0.09)', padding: '0.55rem 0.65rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
          ▶ Voir la fiche
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
        onAddCampaign={addToCampaign}
      />
    </div>
  )
}
