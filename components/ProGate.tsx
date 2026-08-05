'use client'

import SubscriptionButton from '@/components/SubscriptionButton'

type ProGateContext = 'default' | 'campaigns' | 'ai' | 'export' | 'search'

type ProGateProps = {
  compact?: boolean
  title?: string
  description?: string
  context?: ProGateContext
  secondaryHref?: string
  secondaryLabel?: string
}

const contextCopy: Record<ProGateContext, { title: string; intro: string }> = {
  default: {
    title: 'Débloquez toute la puissance de ProspectTube',
    intro:
      'ProspectTube Pro centralise la recherche, l’organisation et la préparation de vos prises de contact pour transformer YouTube en vrai canal de prospection.',
  },
  campaigns: {
    title: 'Passez à des campagnes régulières avec Pro',
    intro:
      'Après votre campagne d’essai, créez de nouvelles campagnes et ajoutez davantage de prospects avec le Plan Pro.',
  },
  ai: {
    title: 'Générez des emails personnalisés avec ProspectTube Pro',
    intro:
      'Passez moins de temps à écrire à la main et obtenez des objets et messages adaptés à chaque créateur sélectionné.',
  },
  export: {
    title: 'Exportez vos prospects avec ProspectTube Pro',
    intro:
      'Récupérez vos résultats et leurs données clés en CSV pour les exploiter dans vos outils de suivi, CRM ou tableurs.',
  },
  search: {
    title: 'Passez à 5 recherches par jour',
    intro:
      'Explorez plus de niches, langues et tailles de chaînes avec un quota quotidien clair.',
  },
}

const benefits = [
  {
    title: '5 recherches par jour',
    text: 'Lancez jusqu’à cinq recherches par jour, avec réinitialisation à minuit UTC.',
  },
  {
    title: 'Intelligence artificielle',
    text: 'Générez des objets et des emails personnalisés adaptés à chaque créateur.',
  },
  {
    title: 'Campagnes',
    text: 'Dépassez la campagne d’essai limitée à cinq prospects et organisez votre prospection régulière.',
  },
  {
    title: 'Gmail',
    text: 'Créez des lots de brouillons plus importants tout en conservant la protection anti-doublon.',
  },
  {
    title: 'Export CSV',
    text: 'Exportez les prospects et leurs données pour les utiliser dans vos autres outils.',
  },
  {
    title: 'Support prioritaire',
    text: 'Obtenez une réponse plus rapide en cas de problème.',
  },
]

export default function ProGate({
  compact = false,
  title,
  description,
  context = 'default',
  secondaryHref = '/dashboard/home',
  secondaryLabel = 'Continuer avec le plan Gratuit',
}: ProGateProps) {
  const copy = contextCopy[context]

  return (
    <section
      className="card pro-gate"
      aria-labelledby="pro-gate-title"
      style={{
        width: '100%',
        maxWidth: compact ? '620px' : '920px',
        margin: '0 auto',
        padding: compact ? '1.35rem' : '2rem',
        borderRadius: '20px',
        border: '1px solid rgba(139,92,246,0.36)',
        background:
          'radial-gradient(circle at top left, rgba(123,99,211,0.24), transparent 36%), linear-gradient(180deg, rgba(23,20,36,0.98), rgba(14,12,23,0.98))',
        boxShadow: '0 24px 70px rgba(0,0,0,0.34)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1.2fr) minmax(260px, 0.8fr)', gap: compact ? '1.1rem' : '1.5rem', alignItems: 'start' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#c4b5fd', fontSize: '0.76rem', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.8rem' }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 99, background: '#a78bfa', boxShadow: '0 0 18px rgba(167,139,250,0.9)' }} />
            ProspectTube Pro
          </div>

          <h2 id="pro-gate-title" className="font-display" style={{ margin: 0, color: '#F0EDF8', fontSize: compact ? '1.35rem' : '2rem', lineHeight: 1.08 }}>
            {title || copy.title}
          </h2>

          <div style={{ color: '#B7AED2', lineHeight: 1.68, fontSize: compact ? '0.88rem' : '0.98rem', margin: '0.85rem 0 0' }}>
            <p style={{ margin: '0 0 0.65rem' }}>{description || copy.intro}</p>
            {!compact && (
              <p style={{ margin: 0 }}>
                Réduisez le temps passé à chercher manuellement, trouvez davantage de prospects qualifiés,
                générez vos emails personnalisés et centralisez votre prospection dans un seul outil.
              </p>
            )}
          </div>
        </div>

        <aside style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', padding: '1rem' }}>
          <div style={{ color: '#8F86AA', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.35rem' }}>Plan Pro</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem' }}>
            <strong style={{ color: '#F0EDF8', fontSize: compact ? '1.65rem' : '2rem', lineHeight: 1 }}>4,90 €</strong>
            <span style={{ color: '#A89FCC', fontSize: '0.86rem' }}>/ mois</span>
          </div>
          <p style={{ color: '#8F86AA', fontSize: '0.78rem', lineHeight: 1.55, margin: '0.65rem 0 0.9rem' }}>
            Facturation mensuelle. Abonnement gérable depuis le portail client Stripe.
          </p>
          <SubscriptionButton
            plan="Gratuit"
            label="Passer à Pro pour 4,90 €/mois"
            fullWidth
            style={{ minHeight: '46px', marginTop: 0, fontSize: '0.86rem', fontWeight: 850 }}
          />
          <a href={secondaryHref} style={{ marginTop: '0.8rem', minHeight: '38px', display: 'inline-flex', width: '100%', alignItems: 'center', justifyContent: 'center', color: '#A89FCC', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 750 }}>
            {secondaryLabel}
          </a>
        </aside>
      </div>

      <div style={{ marginTop: compact ? '1rem' : '1.35rem', display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
        {benefits.map(benefit => (
          <div key={benefit.title} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', background: 'rgba(255,255,255,0.035)', padding: '0.85rem' }}>
            <div style={{ color: '#F0EDF8', fontSize: '0.85rem', fontWeight: 850, marginBottom: '0.35rem' }}>{benefit.title}</div>
            <p style={{ margin: 0, color: '#9188AB', fontSize: '0.78rem', lineHeight: 1.55 }}>{benefit.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
