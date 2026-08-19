'use client'
import { useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from '../auth.module.css'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submittingRef = useRef(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue pendant l'inscription. Réessayez.")
        return
      }
      const login = await signIn('credentials', { email, password, redirect: false })
      if (login?.error) {
        setError('Le compte a été créé, mais la connexion a échoué. Connectez-vous depuis la page de connexion.')
        return
      }
      router.push('/dashboard/home')
      router.refresh()
    } catch {
      setError("Une erreur est survenue pendant l'inscription. Réessayez.")
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.context} aria-label="Présentation de ProspectTube">
        <Link href="/" className={styles.logo}>Prospect<span>Tube</span></Link>
        <div className={styles.promise}>
          <p className={styles.eyebrow}>3 recherches gratuites</p>
          <h1>Passez moins de temps à chercher. Plus de temps à convaincre.</h1>
          <p>Ciblez des YouTubers actifs, comparez leurs signaux publics et gardez vos meilleurs prospects au même endroit.</p>
        </div>
        <div className={styles.proof}><span>Sans carte bancaire</span><span>1 campagne d’essai</span><span>Jusqu’à 5 prospects</span></div>
      </section>
      <section className={styles.formSide}>
        <div className={styles.formWrap}>
          <div className={styles.formHeading}><h2>Commencer gratuitement</h2><p>Créez votre compte et lancez votre première recherche.</p></div>
          <div className={styles.formCard}>
          <form onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="register-name">Prénom</label>
              <input id="register-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Thomas" autoComplete="given-name" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="register-email">Email</label>
              <input id="register-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.fr" autoComplete="email" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="register-password">Mot de passe</label>
              <input id="register-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6 caractères minimum" autoComplete="new-password" minLength={6} required />
            </div>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={`btn-primary ${styles.submit}`} disabled={loading} aria-busy={loading}>
              {loading ? <span className="button-loader"><span className="app-spinner" /> Création…</span> : 'Créer mon compte gratuit'}
            </button>
          </form>
          <p className={styles.switch}>
            Déjà un compte ? <Link href="/login">Se connecter</Link>
          </p>
        </div>
      </div>
      </section>
    </main>
  )
}
