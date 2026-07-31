'use client'

import { getLaunchOfferButtonLabel, getLaunchOfferPricing, type LaunchOfferStatus } from '@/lib/launchOffer'

type LaunchOfferBadgeProps = {
  offer: LaunchOfferStatus
  compact?: boolean
}

type LaunchPriceProps = {
  offer: LaunchOfferStatus
  size?: 'sm' | 'md' | 'lg'
}

export function LaunchOfferBadge({ offer, compact = false }: LaunchOfferBadgeProps) {
  if (!offer.active) return null

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.45rem',
      flexWrap: 'wrap',
      border: '1px solid rgba(94,224,160,0.28)',
      borderRadius: '999px',
      background: 'rgba(94,224,160,0.09)',
      color: '#7ee7b1',
      padding: compact ? '0.34rem 0.58rem' : '0.42rem 0.72rem',
      fontSize: compact ? '0.68rem' : '0.74rem',
      fontWeight: 850,
      lineHeight: 1.2,
    }}>
      <span>🚀 Offre de lancement — 5 places seulement</span>
      <span style={{ color: '#c8f7dd' }}>
        {offer.remainingPlaces} place{offer.remainingPlaces > 1 ? 's' : ''} restante{offer.remainingPlaces > 1 ? 's' : ''}
      </span>
    </div>
  )
}

export function LaunchPrice({ offer, size = 'md' }: LaunchPriceProps) {
  const pricing = getLaunchOfferPricing(offer)
  const mainSize = size === 'lg' ? '2.15rem' : size === 'sm' ? '1.35rem' : '1.75rem'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        {pricing.active && (
          <span style={{ color: '#8F86AA', fontSize: '0.86rem', textDecoration: 'line-through' }}>
            {pricing.regularPrice}
          </span>
        )}
        <strong style={{ color: '#F0EDF8', fontSize: mainSize, lineHeight: 1 }}>
          {pricing.mainPrice}
        </strong>
        <span style={{ color: '#A89FCC', fontSize: '0.86rem' }}>{pricing.period}</span>
      </div>
      {pricing.active && (
        <p style={{ margin: '0.55rem 0 0', color: '#8fe8ba', fontSize: '0.76rem', lineHeight: 1.55 }}>
          Puis toujours 4,90 €/mois tant que l’abonnement reste actif. Tarif normal : 9,90 €/mois.
        </p>
      )}
    </div>
  )
}

export function getLaunchCheckoutLabel(offer: LaunchOfferStatus) {
  return getLaunchOfferButtonLabel(offer)
}
