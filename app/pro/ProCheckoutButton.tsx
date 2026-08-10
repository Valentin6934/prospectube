'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './pro.module.css'

type ProCheckoutButtonProps = {
  authenticated: boolean
  isPro: boolean
}

export default function ProCheckoutButton({ authenticated, isPro }: ProCheckoutButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const continueToCheckout = async () => {
    if (!authenticated) {
      router.push('/register?returnTo=/pro')
      return
    }
    if (isPro) {
      router.push('/dashboard/home')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || typeof data.url !== 'string') {
        throw new Error(data.error || 'Impossible d’ouvrir le paiement Stripe.')
      }
      window.location.assign(data.url)
    } catch (checkoutError) {
      setLoading(false)
      setError(checkoutError instanceof Error ? checkoutError.message : 'Impossible d’ouvrir le paiement Stripe.')
    }
  }

  return (
    <div className={styles.checkoutArea}>
      <button className={styles.checkoutButton} onClick={continueToCheckout} disabled={loading}>
        {loading ? 'Ouverture sécurisée…' : isPro ? 'Accéder au dashboard' : 'Passer à Pro — 4,90 €/mois'}
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  )
}
