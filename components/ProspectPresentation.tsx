'use client'

import type { ReactNode } from 'react'
import { normalizeProspectPresentation, type ProspectPresentationInput } from '@/lib/prospectPresentation'
import ProspectScoreExplanation from './ProspectScoreExplanation'

type ProspectPresentationProps = {
  channel: ProspectPresentationInput
  compact?: boolean
  selected?: boolean
  rightSlot?: ReactNode
}

function getScoreStyles(score: number) {
  if (score >= 80) return { color: '#4ade80' }
  if (score >= 65) return { color: '#facc15' }
  if (score >= 50) return { color: '#fb923c' }
  return { color: '#f87171' }
}

export default function ProspectPresentation({ channel, compact = false, selected = false, rightSlot }: ProspectPresentationProps) {
  const prospect = normalizeProspectPresentation(channel)
  const avatarSize = compact ? 46 : 54

  return (
    <div className="prospect-identity">
      <div className="prospect-main" style={{ gap: compact ? '0.65rem' : undefined }}>
        {prospect.imageUrl ? (
          <img
            src={prospect.imageUrl}
            alt={`Photo de ${prospect.name}`}
            className="prospect-avatar"
            style={{ width: `${avatarSize}px`, height: `${avatarSize}px`, border: selected ? '2px solid rgba(167,139,250,0.75)' : '2px solid rgba(83,58,183,0.35)' }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="prospect-avatar"
            style={{ width: `${avatarSize}px`, height: `${avatarSize}px`, background: `${prospect.color}33`, border: selected ? '2px solid rgba(167,139,250,0.75)' : `2px solid ${prospect.color}66`, display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: compact ? '0.78rem' : '0.9rem', color: prospect.color }}
          >
            {prospect.initials}
          </div>
        )}

        <div className="prospect-copy">
          <div className="prospect-title-row">
            <div className="prospect-name" style={{ fontSize: compact ? '0.95rem' : '1rem' }}>{prospect.name}</div>
            {prospect.activityLabel && (
              <span className="prospect-activity" style={{ color: prospect.activityColor }}>
                {prospect.activityLabel}
              </span>
            )}
            <span className="prospect-score-label" style={getScoreStyles(prospect.score)}>
              {prospect.scoreLabel}
            </span>
            <span className="prospect-score" style={{ fontSize: compact ? '0.82rem' : undefined }}>{prospect.score}/100</span>
            <ProspectScoreExplanation compact />
          </div>

          <div className="prospect-stats" style={{ marginBottom: prospect.contacts.length > 0 ? undefined : 0 }}>
            {prospect.stats.map(stat => (
              <span key={stat} className="prospect-stat">{stat}</span>
            ))}
          </div>

          {!compact && (
            <p title={prospect.scoreReason} className="prospect-reason" style={{ margin: prospect.contacts.length > 0 ? undefined : '0.45rem 0 0' }}>
              {prospect.scoreReason}
            </p>
          )}

          {prospect.contacts.length > 0 && (
            <div className="prospect-contacts">
              {prospect.contacts.map(contact => (
                <a
                  key={contact.key}
                  href={contact.href}
                  target={contact.href.startsWith('http') ? '_blank' : undefined}
                  rel={contact.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="prospect-contact"
                  style={{ color: contact.color }}
                >
                  {contact.label}
                </a>
              ))}
              {prospect.youtubeUrl && (
                <a href={prospect.youtubeUrl} target="_blank" rel="noopener noreferrer" className="prospect-contact">
                  YouTube
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {rightSlot && (
        <div className="prospect-right-slot">
          {rightSlot}
        </div>
      )}
    </div>
  )
}
