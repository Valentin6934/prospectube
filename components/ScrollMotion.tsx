'use client'

import { useEffect } from 'react'

export default function ScrollMotion() {
  useEffect(() => {
    const root = document.documentElement
    const reveals = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    root.classList.add('motion-ready')

    if (reduceMotion || !('IntersectionObserver' in window)) {
      reveals.forEach(element => element.dataset.visible = 'true')
      return () => root.classList.remove('motion-ready')
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        ;(entry.target as HTMLElement).dataset.visible = 'true'
        observer.unobserve(entry.target)
      })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })

    reveals.forEach(element => observer.observe(element))
    return () => {
      observer.disconnect()
      root.classList.remove('motion-ready')
    }
  }, [])

  return null
}
