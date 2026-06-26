'use client'

import { ProspectChannel } from './ProspectCard'

type CreatorDetailsProps = {
  channel: ProspectChannel
  open: boolean
  canEmail?: boolean
  isFavorite?: boolean
  favoriteLoading?: boolean
  removing?: boolean
  showFavoriteButton?: boolean
  showRemoveButton?: boolean
  onClose: () => void
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
  if (!createdAt) return 'Inconnue'
  const year = new Date(createdAt).getFullYear()
  return Number.isFinite(year) ? String(year) : 'Inconnue'
}

function getScoreStyles(score: number) {
  if (score >= 80) return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
  if (score >= 65) return { background: 'rgba(234,179,8,0.15)', color: '#eab308' }
  if (score >= 50) return { background: 'rgba(249,115,22,0.15)', color: '#f97316' }
  return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
}

function getReasonParts(reason: string | null | undefined): string[] {
  return String(reason || "Peu d'informations exploitables").split(' • ').filter(Boolean)
}

function getWeaknesses(channel: ProspectChannel, viewsPerSubscriber: number): string[] {
  const weaknesses: string[] = []
  if (!channel.email) weaknesses.push('Email direct non trouvé')
  if (!channel.instagram && !channel.tiktok && !channel.twitch && !channel.website) weaknesses.push('Peu de contacts publics')
  if ((channel.videoCount || 0) < 50) weaknesses.push('Volume de vidéos limité')
  if (viewsPerSubscriber > 0 && viewsPerSubscriber < 5) weaknesses.push('Ratio vues/abonnés modéré')
  if (weaknesses.length === 0) weaknesses.push('Aucune faiblesse majeure détectée')
  return weaknesses
}

function getProspectingAdvice(channel: ProspectChannel, score: number): string {
  if (channel.email && score >= 80) return 'Contacte directement par email avec une proposition courte et personnalisée.'
  if (channel.instagram || channel.tiktok) return 'Approche via réseau social avec un message léger avant de proposer une collaboration.'
  if (channel.website) return 'Utilise le site web pour identifier le bon contact avant de pitcher.'
  return 'Commence par interagir avec le contenu avant une approche commerciale.'
}

function getDifficulty(score: number, hasEmail: boolean): string {
  if (hasEmail && score >= 80) return 'Faible'
  if (score >= 65) return 'Moyenne'
  return 'Élevée'
}

function getReplyProbability(score: number, hasEmail: boolean): string {
  const probability = Math.min(85, Math.max(15, score * 0.7 + (hasEmail ? 15 : 0)))
  return `${Math.round(probability)}%`
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem' }}>
      <div style={{ color: '#6B5F96', fontSize: '0.72rem', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ color: '#F0EDF8', fontWeight: 700, fontSize: '0.92rem' }}>{value}</div>
    </div>
  )
}

export default function CreatorDetails({
  channel,
  open,
  canEmail = false,
  isFavorite = false,
  favoriteLoading = false,
  removing = false,
  showFavoriteButton = false,
  showRemoveButton = false,
  onClose,
  onGenerateEmail,
  onAddFavorite,
  onRemoveFavorite,
}: CreatorDetailsProps) {
  if (!open) return null

  const score = channel.score || 0
  const color = channel.color || '#533AB7'
  const name = channel.name || 'Chaîne inconnue'
  const avatar = channel.avatar || name.slice(0, 2).toUpperCase()
  const views = channel.totalViews || channel.viewCount || 0
  const subscribers = channel.subsNum || 0
  const videos = channel.videoCount || 0
  const viewsPerSubscriber = channel.viewsPerSubscriber || (subscribers > 0 ? views / subscribers : 0)
  const reasons = getReasonParts(channel.scoreReason)
  const weaknesses = getWeaknesses(channel, viewsPerSubscriber)
  const hasEmail = Boolean(channel.email)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.66)', display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div
        className="card"
        onClick={event => event.stopPropagation()}
        style={{ width: 'min(620px, 100%)', height: '100vh', overflowY: 'auto', borderRadius: '0', borderLeft: '1px solid rgba(83,58,183,0.35)', padding: '1.25rem', animation: 'creatorDrawerIn 220ms ease-out', boxShadow: '-24px 0 60px rgba(0,0,0,0.35)' }}
      >
        <style>{`
          @keyframes creatorDrawerIn {
            from { transform: translateX(32px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center', minWidth: 0 }}>
            {channel.thumbnail ? (
              <img src={channel.thumbnail} alt="" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(83,58,183,0.45)' }} />
            ) : (
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: `${color}33`, border: `2px solid ${color}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color }}>{avatar}</div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#F0EDF8', fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.35rem' }}>{name}</div>
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ padding: '0.18rem 0.55rem', borderRadius: '999px', ...getScoreStyles(score), fontSize: '0.75rem', fontWeight: 700 }}>{channel.scoreLabel || '🔴 Faible potentiel'}</span>
                <span style={{ color: '#F0EDF8', fontWeight: 800 }}>{score}/100</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#A89FCC', borderRadius: '8px', padding: '0.45rem 0.7rem', cursor: 'pointer' }}>Fermer</button>
        </div>

        <section style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ color: '#F0EDF8', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Statistiques</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
            <StatCard label="Abonnés" value={channel.subs || formatCompactNumber(subscribers)} />
            <StatCard label="Vues" value={channel.totalViewsFormatted || formatCompactNumber(views)} />
            <StatCard label="Vidéos" value={channel.videoCountFormatted || formatCompactNumber(videos)} />
            <StatCard label="Création" value={getCreatedYear(channel.createdAt || channel.publishedAt || channel.channelCreatedAt)} />
            <StatCard label="Vues / abonné" value={viewsPerSubscriber ? viewsPerSubscriber.toFixed(1) : 'Inconnu'} />
          </div>
        </section>

        <section style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ color: '#F0EDF8', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Contacts</h3>
          <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.85rem' }}>
            {channel.email && <a href={`mailto:${channel.email}`} style={{ color: '#22c55e', textDecoration: 'none' }}>📧 {channel.email}</a>}
            {channel.instagram && <a href={channel.instagram} target="_blank" rel="noopener noreferrer" style={{ color: '#e879f9', textDecoration: 'none' }}>📱 Instagram</a>}
            {channel.tiktok && <a href={channel.tiktok} target="_blank" rel="noopener noreferrer" style={{ color: '#f472b6', textDecoration: 'none' }}>🎵 TikTok</a>}
            {channel.twitch && <a href={channel.twitch} target="_blank" rel="noopener noreferrer" style={{ color: '#9146FF', textDecoration: 'none' }}>🎮 Twitch</a>}
            {channel.website && <a href={channel.website} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>🌍 Site</a>}
            {channel.channelUrl && <a href={channel.channelUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'none' }}>▶ YouTube</a>}
            {!channel.email && !channel.instagram && !channel.tiktok && !channel.twitch && !channel.website && <span style={{ color: '#6B5F96' }}>Aucun contact public trouvé</span>}
          </div>
        </section>

        <section style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ color: '#F0EDF8', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Analyse Prospect</h3>
          <div style={{ display: 'grid', gap: '0.8rem' }}>
            <div>
              <div style={{ color: '#A89FCC', fontSize: '0.78rem', marginBottom: '0.35rem' }}>Pourquoi ce score</div>
              <div style={{ display: 'grid', gap: '0.3rem', color: '#C4BCDF', fontSize: '0.85rem' }}>{reasons.map(reason => <div key={reason}>✓ {reason}</div>)}</div>
            </div>
            <div>
              <div style={{ color: '#A89FCC', fontSize: '0.78rem', marginBottom: '0.35rem' }}>Points faibles</div>
              <div style={{ display: 'grid', gap: '0.3rem', color: '#C4BCDF', fontSize: '0.85rem' }}>{weaknesses.map(item => <div key={item}>• {item}</div>)}</div>
            </div>
            <StatCard label="Conseil de prospection" value={getProspectingAdvice(channel, score)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <StatCard label="Difficulté estimée" value={getDifficulty(score, hasEmail)} />
              <StatCard label="Probabilité de réponse" value={getReplyProbability(score, hasEmail)} />
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ color: '#F0EDF8', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Description complète</h3>
          <div style={{ color: '#C4BCDF', fontSize: '0.9rem', lineHeight: 1.7, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.9rem' }}>{channel.desc || 'Pas de description disponible.'}</div>
        </section>

        <section>
          <h3 style={{ color: '#F0EDF8', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Actions</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.55rem' }}>
            {showFavoriteButton && <button onClick={() => onAddFavorite?.(channel)} disabled={isFavorite || favoriteLoading} style={{ background: isFavorite ? 'rgba(234,179,8,0.16)' : 'rgba(83,58,183,0.14)', color: isFavorite ? '#eab308' : '#A89FCC', border: '1px solid rgba(83,58,183,0.35)', padding: '0.7rem', borderRadius: '8px', cursor: isFavorite ? 'default' : 'pointer', fontWeight: 700 }}>{isFavorite ? '⭐ Favori' : favoriteLoading ? 'Ajout...' : '☆ Favori'}</button>}
            {showRemoveButton && <button onClick={() => onRemoveFavorite?.(channel)} disabled={removing} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '0.7rem', borderRadius: '8px', cursor: removing ? 'default' : 'pointer', fontWeight: 700 }}>{removing ? 'Suppression...' : 'Supprimer'}</button>}
            {onGenerateEmail && <button onClick={() => onGenerateEmail(channel)} style={{ background: canEmail ? 'linear-gradient(135deg, #533AB7, #7B63D3)' : 'rgba(83,58,183,0.15)', color: canEmail ? 'white' : '#6B5F96', border: '1px solid rgba(83,58,183,0.22)', padding: '0.7rem', borderRadius: '8px', cursor: canEmail ? 'pointer' : 'not-allowed', fontWeight: 700 }}>{canEmail ? '✨ Message IA' : '🔒 IA Pro'}</button>}
            <button onClick={() => channel.email && navigator.clipboard.writeText(channel.email)} disabled={!channel.email} style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: channel.email ? '#22c55e' : '#6B5F96', padding: '0.7rem', borderRadius: '8px', cursor: channel.email ? 'pointer' : 'not-allowed', fontWeight: 700 }}>Copier email</button>
          </div>
        </section>
      </div>
    </div>
  )
}
