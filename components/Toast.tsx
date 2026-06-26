'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'
export type ToastData = { message: string; type: ToastType }

export function useToast(duration = 3200) {
  const [toast, setToast] = useState<ToastData | null>(null)
  const timer = useRef<number | null>(null)

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    if (timer.current) window.clearTimeout(timer.current)
    setToast({ message, type })
    timer.current = window.setTimeout(() => setToast(null), duration)
  }, [duration])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  return { toast, showToast }
}

export default function Toast({ toast, raised = false }: { toast: ToastData | null; raised?: boolean }) {
  if (!toast) return null

  const icon = toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : 'i'

  return (
    <div className={`app-toast app-toast-${toast.type}${raised ? ' app-toast-raised' : ''}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <span className="app-toast-icon" aria-hidden="true">{icon}</span>
      <span>{toast.message}</span>
    </div>
  )
}
