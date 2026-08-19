import Link from 'next/link'
import HomeSignOutButton from './HomeSignOutButton'
import styles from '@/app/dashboard/home/home.module.css'
import { isPro } from '@/lib/plan'

type MainAppNavProps = {
  plan: string
  active?: 'home' | 'favorites' | 'history' | 'campaigns' | 'settings' | 'search'
  quotaLabel?: string
}

export default function MainAppNav({ plan, active, quotaLabel }: MainAppNavProps) {
  return (
    <nav className={styles.nav} aria-label="Navigation principale">
      <div className={styles.navInner}>
        <Link href="/dashboard/home" className={styles.logo}>
          Prospect<span>Tube</span>
        </Link>
        <div className={styles.navActions}>
          <div className={styles.secondaryNav}>
            <Link href="/dashboard/home" aria-current={active === 'home' ? 'page' : undefined}>🏠 Accueil</Link>
            <Link href="/favorites" aria-current={active === 'favorites' ? 'page' : undefined}>⭐ Favoris</Link>
            <Link href="/history" aria-current={active === 'history' ? 'page' : undefined}>🕘 Historique</Link>
            <Link href="/campaigns" aria-current={active === 'campaigns' ? 'page' : undefined}>🎯 Campagnes</Link>
          </div>
          <Link href="/dashboard" className={styles.searchButton} aria-current={active === 'search' ? 'page' : undefined}>🔍 Nouvelle recherche</Link>
          <Link href="/settings" className={styles.settingsLink} aria-current={active === 'settings' ? 'page' : undefined}>⚙️ Paramètres</Link>
          {quotaLabel && <span className={styles.quotaBadge} aria-label={`Quota de recherche : ${quotaLabel}`}>{quotaLabel}</span>}
          {isPro(plan)
            ? <span className={styles.planBadge}>Plan Pro</span>
            : <Link href="/pro" className={styles.planBadge}>Découvrir Pro</Link>}
          <HomeSignOutButton className={styles.signOut} />
        </div>
      </div>
    </nav>
  )
}
