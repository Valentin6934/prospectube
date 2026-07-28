'use client'

import SubscriptionButton from '@/components/SubscriptionButton'

type ProGateProps = {
  compact?: boolean
  title?: string
  description?: string
}

export default function ProGate({
  compact = false,
  title = 'Accélérez votre prospection avec ProspectTube Pro',
  description = 'Débloquez les outils pensés pour préparer, organiser et envoyer vos prises de contact plus vite, sans changer votre façon de travailler.',
}: ProGateProps) {
  const features = [
    'Recherches illimitées',
    'Génération d’emails personnalisés par IA',
    'Campagnes de prospection',
    'Connexion Gmail',
    'Création de brouillons ou envoi des emails',
    'Export CSV',
    'Support prioritaire',
  ]

  return (
    <div
      className="card"
      style={{
        width: '100%',
        maxWidth: compact ? '560px' : '820px',
        margin: '0 auto',
        padding: compact ? '1.35rem' : '2.25rem',
        borderRadius: '18px',
        border: '1px solid rgba(139,92,246,0.35)',
        background: 'radial-gradient(circle at top left, rgba(123,99,211,0.28), transparent 38%), rgba(18,16,28,0.98)',
        boxShadow: '0 24px 70px rgba(0,0,0,0.32)',
      }}
    >
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#c4b5fd', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 99, background: '#a78bfa', boxShadow: '0 0 18px rgba(167,139,250,0.9)' }} />
        ProspectTube Pro
      </div>
      <h2 className="font-display" style={{ margin: 0, color: '#F0EDF8', fontSize: compact ? '1.2rem' : '1.75rem', lineHeight: 1.1 }}>
        {title}
      </h2>
      <p style={{ color: '#B7AED2', lineHeight: 1.65, fontSize: compact ? '0.86rem' : '0.95rem', margin: '0.8rem 0 1.15rem' }}>
        {description}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', marginBottom: '1rem' }}>
        <strong style={{ color: '#F0EDF8', fontSize: compact ? '1.35rem' : '1.7rem' }}>9,90 €</strong>
        <span style={{ color: '#8F86AA', fontSize: '0.86rem' }}>/ mois</span>
      </div>
      <div style={{ margin: '1rem 0', display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.65rem' }}>
        {features.map(feature => (
          <div key={feature} style={{ color: '#C4BCDF', fontSize: '0.84rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ color: '#22c55e', fontWeight: 900 }}>✓</span>
            <span>{feature}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap', marginTop: '1.1rem' }}>
        <SubscriptionButton plan="Gratuit" />
        <a href="/dashboard/home" style={{ color: '#A89FCC', textDecoration: 'none', fontSize: '0.84rem', fontWeight: 700 }}>
          Retour au dashboard
        </a>
      </div>
      <p style={{ color: '#7D739A', fontSize: '0.74rem', lineHeight: 1.5, margin: '0.9rem 0 0' }}>
        Abonnement mensuel sans engagement, gérable depuis le portail Stripe une fois activé.
      </p>
    </div>
  )
}
