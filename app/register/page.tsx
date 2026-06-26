'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Erreur lors de l\'inscription')
      setLoading(false)
      return
    }
    await signIn('credentials', { email, password, redirect: false })
    router.push('/dashboard/home')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0812', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/">
            <div className="font-display" style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
              Prospect<span className="grad-text">Tube</span>
            </div>
          </Link>
          <p style={{ color: '#A89FCC', fontSize: '0.9rem' }}>Crée ton compte gratuitement</p>
        </div>
        <div className="card" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#A89FCC', marginBottom: '0.4rem' }}>Ton prénom</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Thomas" required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#A89FCC', marginBottom: '0.4rem' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="toi@email.com" required />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#A89FCC', marginBottom: '0.4rem' }}>Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} required />
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>}
            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem' }} disabled={loading}>
              {loading ? 'Création...' : 'Créer mon compte gratuit →'}
            </button>
          </form>
          <p style={{ textAlign: 'center', color: '#6B5F96', fontSize: '0.85rem', marginTop: '1.5rem' }}>
            Déjà un compte ?{' '}
            <Link href="/login" style={{ color: '#a78bfa', textDecoration: 'none' }}>Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
