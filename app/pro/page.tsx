import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPlanName } from '@/lib/plan'
import { PRODUCT_LIMITS, PRO_MONTHLY_PRICE_LABEL } from '@/lib/product'
import ProCheckoutButton from './ProCheckoutButton'
import styles from './pro.module.css'

export const metadata: Metadata = {
  title: 'Plan Pro — ProspectTube',
  description: 'Comparez les plans Gratuit et Pro de ProspectTube pour organiser votre prospection YouTube.',
  robots: { index: true, follow: true },
}

const rows = [
  ['Recherches', `${PRODUCT_LIMITS.freeLifetimeSearches} réussies à vie`, `${PRODUCT_LIMITS.proDailySearches} réussies par jour`],
  ['Campagnes', `${PRODUCT_LIMITS.freeCampaigns} campagne d’essai`, 'Campagnes supplémentaires'],
  ['Prospects par campagne', `${PRODUCT_LIMITS.freeCampaignProspects} maximum`, 'Jusqu’à 20 par lot'],
  ['Prospect Score', 'Inclus', 'Inclus'],
  ['Contacts publics', 'Inclus', 'Inclus'],
  ['Favoris et historique', 'Inclus', 'Inclus'],
  ['Brouillons Gmail', 'Campagne d’essai', 'Campagnes régulières'],
  ['Export CSV', 'Non inclus', 'Inclus'],
] as const

export default async function ProPage() {
  const session = await getServerSession(authOptions)
  const plan = getPlanName((session?.user as { plan?: string } | undefined)?.plan)

  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Navigation Plan Pro">
        <Link href="/" className={styles.logo}>Prospect<span>Tube</span></Link>
        <Link href={session ? '/dashboard/home' : '/login'} className={styles.backLink}>
          {session ? 'Retour au dashboard' : 'Se connecter'}
        </Link>
      </nav>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>ProspectTube Pro</p>
        <h1>Plus de recherches. Plus de campagnes. Le même contrôle.</h1>
        <p className={styles.lead}>
          Pro est conçu pour les MiniMakers et monteurs vidéo qui prospectent régulièrement :
          recherchez des créateurs actifs chaque jour, organisez plusieurs campagnes et exportez votre suivi.
        </p>
        <div className={styles.priceLine}>
          <strong>{PRO_MONTHLY_PRICE_LABEL}</strong><span>/ mois</span>
        </div>
        <p className={styles.billingNote}>Facturation mensuelle, sans engagement. Annulation depuis le portail Stripe.</p>
        <ProCheckoutButton authenticated={Boolean(session)} isPro={plan === 'Pro'} />
      </section>

      <section className={styles.comparison} aria-labelledby="comparison-title">
        <div className={styles.sectionHeading}>
          <p>Comparer les plans</p>
          <h2 id="comparison-title">Choisissez selon votre rythme de prospection.</h2>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Fonction</th><th>Gratuit</th><th>Pro</th></tr></thead>
            <tbody>{rows.map(([feature, free, pro]) => (
              <tr key={feature}><th scope="row">{feature}</th><td>{free}</td><td>{pro}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className={styles.workflow}>
        <div><span>01</span><h2>Trouvez des chaînes actives</h2><p>ProspectTube classe les créateurs selon leur activité et leur potentiel commercial estimé.</p></div>
        <div><span>02</span><h2>Gardez les bons signaux</h2><p>Comparez l’activité récente, les performances publiques et les coordonnées publiées.</p></div>
        <div><span>03</span><h2>Préparez vos campagnes</h2><p>Organisez vos prospects et créez uniquement les brouillons Gmail que vous choisissez.</p></div>
      </section>

      <section className={styles.finalCta}>
        <div><p>Prêt à prospecter régulièrement ?</p><h2>Passez à 5 recherches par jour.</h2></div>
        <ProCheckoutButton authenticated={Boolean(session)} isPro={plan === 'Pro'} />
      </section>
    </main>
  )
}
