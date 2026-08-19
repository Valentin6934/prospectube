'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from '../auth.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
    } else {
      router.push('/dashboard/home')
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.context} aria-label="Présentation de ProspectTube">
        <Link href="/" className={styles.logo}>Prospect<span>Tube</span></Link>
        <div className={styles.promise}>
          <p className={styles.eyebrow}>Prospection YouTube ciblée</p>
          <h1>Trouvez les créateurs qui méritent votre prochain message.</h1>
          <p>ProspectTube aide les MiniMakers et monteurs vidéo à repérer des chaînes actives, comparer leur potentiel et organiser leur prospection.</p>
        </div>
        <div className={styles.proof}><span>Chaînes actives</span><span>Contacts publics</span><span>Messages sous votre contrôle</span></div>
      </section>
      <section className={styles.formSide}>
        <div className={styles.formWrap}>
          <div className={styles.formHeading}><h2>Bon retour parmi nous</h2><p>Connectez-vous pour reprendre votre prospection.</p></div>
          <div className={styles.formCard}>
          <form onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="login-email">Email</label>
              <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.fr" autoComplete="email" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="login-password">Mot de passe</label>
              <input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
            </div>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={`btn-primary ${styles.submit}`} disabled={loading} aria-busy={loading}>
              {loading ? <span className="button-loader"><span className="app-spinner" /> Connexion…</span> : 'Se connecter'}
            </button>
          </form>
          <p className={styles.switch}>
            Pas encore de compte ? <Link href="/register">Tester gratuitement</Link>
          </p>
        </div>
      </div>
      </section>
    </main>
  )
}
