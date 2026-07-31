'use client'

import { useEffect, useState } from 'react'
import { getDefaultLaunchOfferStatus, type LaunchOfferStatus } from '@/lib/launchOffer'

type LaunchOfferState = {
  offer: LaunchOfferStatus
  loading: boolean
  error: boolean
}

export function useLaunchOffer(): LaunchOfferState {
  const [state, setState] = useState<LaunchOfferState>({
    offer: getDefaultLaunchOfferStatus(),
    loading: true,
    error: false,
  })

  useEffect(() => {
    let cancelled = false

    fetch('/api/launch-offer', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('launch_offer_unavailable')))
      .then(data => {
        if (cancelled) return
        setState({
          offer: {
            active: Boolean(data.active),
            launchPrice: Number(data.launchPrice) || 4.95,
            regularPrice: Number(data.regularPrice) || 9.9,
            discountedPrice: Number(data.discountedPrice ?? data.launchPrice) || 4.95,
            originalPrice: Number(data.originalPrice ?? data.regularPrice) || 9.9,
            maxPlaces: Number(data.maxPlaces) || 5,
            usedPlaces: Number(data.usedPlaces) || 5,
            remainingPlaces: Number(data.remainingPlaces) || 0,
            remaining: Number(data.remaining ?? data.remainingPlaces) || 0,
            checkoutConfigured: Boolean(data.checkoutConfigured),
            adminMessage: typeof data.adminMessage === 'string' ? data.adminMessage : undefined,
          },
          loading: false,
          error: false,
        })
      })
      .catch(() => {
        if (cancelled) return
        setState({
          offer: getDefaultLaunchOfferStatus(),
          loading: false,
          error: true,
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
