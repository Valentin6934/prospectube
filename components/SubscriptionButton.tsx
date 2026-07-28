'use client'

import { useState, type CSSProperties } from 'react'

type SubscriptionButtonProps = {
  plan: string
  label?: string
  style?: CSSProperties
  fullWidth?: boolean
}

export default function SubscriptionButton({
  plan,
  label,
  style,
  fullWidth = false,
}: SubscriptionButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isPro = plan === 'Pro'

  const openStripe = async () => {
    setLoading(true)
    setError('')

    const response = await fetch(isPro ? '/api/stripe/portal' : '/api/stripe/checkout', {
      method: 'POST',
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok || typeof data.url !== 'string') {
      setLoading(false)
      setError(data.error || 'Impossible d’ouvrir Stripe.')
      return
    }

    window.location.assign(data.url)
  }

  return (
    <div style={{ width: fullWidth ? '100%' : undefined }}>
      <button
        onClick={openStripe}
        disabled={loading}
        className={isPro ? 'btn btn-secondary' : 'btn-primary'}
        style={{
          marginTop: '0.65rem',
          padding: '0.58rem 0.8rem',
          fontSize: '0.76rem',
          whiteSpace: 'nowrap',
          width: fullWidth ? '100%' : undefined,
          ...style,
        }}
      >
        {loading
          ? <span className="button-loader"><span className="app-spinner" /> Ouverture...</span>
          : isPro ? 'Gérer mon abonnement' : label || 'Passer Pro — 9,90 €/mois'}
      </button>
      {error && (
        <div role="alert" style={{ maxWidth: fullWidth ? '100%' : '250px', marginTop: '0.45rem', color: '#f87171', fontSize: '0.7rem' }}>
          {error}
        </div>
      )}
    </div>
  )
}
