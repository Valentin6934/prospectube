'use client'

import type { ReactNode } from 'react'
import { normalizeProspectPresentation, type ProspectPresentationInput } from '@/lib/prospectPresentation'

type ProspectPresentationProps = {
  channel: ProspectPresentationInput
  compact?: boolean
  selected?: boolean
  rightSlot?: ReactNode
}

function getScoreStyles(score: number) {
  if (score >= 80) return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
  if (score >= 65) return { background: 'rgba(234,179,8,0.15)', color: '#eab308' }
  if (score >= 50) return { background: 'rgba(249,115,22,0.15)', color: '#f97316' }
  return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
}

export default function ProspectPresentation({ channel, compact = false, selected = false, rightSlot }: ProspectPresentationProps) {
  const prospect = normalizeProspectPresentation(channel)
  const avatarSize = compact ? 46 : 54

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'flex-start', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: compact ? '0.65rem' : '0.9rem', minWidth: 0, flex: 1 }}>
        {prospect.imageUrl ? (
          <img
            src={prospect.imageUrl}
            alt={`Photo de ${prospect.name}`}
            style={{ width: `${avatarSize}px`, height: `${avatarSize}px`, borderRadius: '50%', objectFit: 'cover', border: selected ? '2px solid rgba(167,139,250,0.75)' : '2px solid rgba(83,58,183,0.35)', flexShrink: 0 }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{ width: `${avatarSize}px`, height: `${avatarSize}px`, borderRadius: '50%', background: `${prospect.color}33`, border: selected ? '2px solid rgba(167,139,250,0.75)' : `2px solid ${prospect.color}66`, display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: compact ? '0.78rem' : '0.9rem', color: prospect.color, flexShrink: 0 }}
          >
            {prospect.initials}
          </div>
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
            <div style={{ fontWeight: 800, fontSize: compact ? '0.95rem' : '1rem', color: '#F0EDF8', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prospect.name}</div>
            <span style={{ padding: '0.18rem 0.55rem', borderRadius: '999px', ...getScoreStyles(prospect.score), fontSize: '0.72rem', fontWeight: 800 }}>
              {prospect.scoreLabel}
            </span>
            <span style={{ color: '#F0EDF8', fontWeight: 900, fontSize: compact ? '0.84rem' : '0.9rem' }}>{prospect.score}/100</span>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: prospect.contacts.length > 0 ? '0.55rem' : 0 }}>
            {prospect.stats.map(stat => (
              <span key={stat} style={{ fontSize: '0.75rem', color: '#C4BCDF', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '0.22rem 0.55rem' }}>{stat}</span>
            ))}
          </div>

          {prospect.contacts.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {prospect.contacts.map(contact => (
                <a
                  key={contact.key}
                  href={contact.href}
                  target={contact.href.startsWith('http') ? '_blank' : undefined}
                  rel={contact.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  style={{ fontSize: '0.75rem', color: contact.color, background: `${contact.color}1F`, border: `1px solid ${contact.color}3D`, borderRadius: '999px', padding: '0.22rem 0.55rem', textDecoration: 'none', fontWeight: 700 }}
                >
                  {contact.label}
                </a>
              ))}
              {prospect.youtubeUrl && (
                <a href={prospect.youtubeUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#a78bfa', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '999px', padding: '0.22rem 0.55rem', textDecoration: 'none', fontWeight: 700 }}>
                  YouTube
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {rightSlot}
    </div>
  )
}
