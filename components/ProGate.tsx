'use client'

import SubscriptionButton from '@/components/SubscriptionButton'

export default function ProGate({ compact = false }: { compact?: boolean }) {
  const features = [
    'Recherches illimitées',
    'IA pour écrire les emails',
    'Gmail connecté',
    'Campagnes',
    'Export CSV',
    'Support prioritaire',
  ]

  return (
    <div
      className="card"
      style={{
        width: '100%',
        maxWidth: compact ? '520px' : '680px',
        margin: '0 auto',
        padding: compact ? '1.25rem' : '1.75rem',
        borderRadius: '8px',
        border: '1px solid rgba(139,92,246,0.35)',
        background: '#12101c',
      }}
    >
      <div style={{ color: '#a78bfa', fontSize: '1.15rem', marginBottom: '0.65rem' }}>🔒</div>
      <h2 className="font-display" style={{ margin: 0, color: '#F0EDF8', fontSize: compact ? '1rem' : '1.2rem' }}>
        Disponible avec ProspectTube Pro
      </h2>
      <div style={{ margin: '1rem 0', display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.55rem' }}>
        {features.map(feature => (
          <div key={feature} style={{ color: '#C4BCDF', fontSize: '0.82rem' }}>
            <span style={{ color: '#22c55e', marginRight: '0.45rem' }}>✓</span>{feature}
          </div>
        ))}
      </div>
      <div style={{ color: '#F0EDF8', fontSize: '1.05rem', fontWeight: 800 }}>9,90 €/mois</div>
      <SubscriptionButton plan="Gratuit" />
    </div>
  )
}
