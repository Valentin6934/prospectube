'use client'

import { useEffect, useId, useState } from 'react'
import {
  PROSPECT_SCORE_EXPLANATION,
  PROSPECT_SCORE_LEVELS,
  PROSPECT_SCORE_SIGNALS,
  PROSPECT_SCORE_TRANSPARENCY_NOTE,
} from '@/lib/prospectScoreInfo'

type ProspectScoreExplanationProps = {
  compact?: boolean
}

export default function ProspectScoreExplanation({ compact = false }: ProspectScoreExplanationProps) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Comprendre le calcul du Prospect Score"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          background: compact ? 'rgba(255,255,255,0.04)' : 'rgba(83,58,183,0.14)',
          border: '1px solid rgba(167,139,250,0.28)',
          color: '#C4BCDF',
          borderRadius: '999px',
          padding: compact ? '0.18rem 0.45rem' : '0.42rem 0.72rem',
          fontSize: compact ? '0.7rem' : '0.78rem',
          fontWeight: 800,
          cursor: 'pointer',
          lineHeight: 1.2,
        }}
      >
        <span aria-hidden="true">i</span>
        {!compact && <span>Comment est calcule le score ?</span>}
      </button>

      {open && (
        <div
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(4,3,10,0.68)',
            backdropFilter: 'blur(12px)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
            animation: 'modalFadeIn 160ms ease-out',
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            style={{
              width: 'min(620px, 100%)',
              maxHeight: 'min(86vh, 720px)',
              overflowY: 'auto',
              borderRadius: '16px',
              border: '1px solid rgba(167,139,250,0.28)',
              background:
                'radial-gradient(circle at top left, rgba(123,99,211,0.22), transparent 34%), #120F1E',
              boxShadow: '0 28px 80px rgba(0,0,0,0.42)',
              padding: '1.15rem',
              color: '#F0EDF8',
              animation: 'modalSlideIn 180ms ease-out',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
              <div>
                <p style={{ margin: '0 0 0.25rem', color: '#a78bfa', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Prospect Score
                </p>
                <h2 id={titleId} className="font-display" style={{ margin: 0, fontSize: '1.15rem', lineHeight: 1.2 }}>
                  Comment est calcule le score ?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer l'explication du Prospect Score"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#C4BCDF',
                  cursor: 'pointer',
                  fontWeight: 900,
                }}
              >
                x
              </button>
            </div>

            <p id={descriptionId} style={{ margin: '0 0 1rem', color: '#C4BCDF', fontSize: '0.88rem', lineHeight: 1.65 }}>
              {PROSPECT_SCORE_EXPLANATION}
            </p>

            <div style={{ display: 'grid', gap: '0.9rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.45rem', color: '#F0EDF8', fontSize: '0.9rem' }}>Signaux utilises</h3>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#B9B0D4', fontSize: '0.82rem', lineHeight: 1.65 }}>
                  {PROSPECT_SCORE_SIGNALS.map(signal => <li key={signal}>{signal}</li>)}
                </ul>
              </div>

              <div>
                <h3 style={{ margin: '0 0 0.45rem', color: '#F0EDF8', fontSize: '0.9rem' }}>Niveaux de score</h3>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {PROSPECT_SCORE_LEVELS.map(level => (
                    <div key={level.label} style={{ display: 'grid', gridTemplateColumns: '86px minmax(0, 1fr)', gap: '0.7rem', alignItems: 'baseline', color: '#C4BCDF', fontSize: '0.8rem' }}>
                      <strong style={{ color: '#F0EDF8' }}>
                        {level.min}-{level.max}
                      </strong>
                      <span>
                        {level.label} : {level.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ border: '1px solid rgba(234,179,8,0.22)', background: 'rgba(234,179,8,0.07)', color: '#D8C896', borderRadius: '12px', padding: '0.75rem', fontSize: '0.8rem', lineHeight: 1.55 }}>
                {PROSPECT_SCORE_TRANSPARENCY_NOTE}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
