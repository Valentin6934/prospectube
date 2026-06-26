'use client'

import { signOut } from 'next-auth/react'

export default function HomeSignOutButton({ className }: { className?: string }) {
  return (
    <button className={className} onClick={() => signOut({ callbackUrl: '/' })}>
      Déconnexion
    </button>
  )
}
