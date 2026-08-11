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

const proBenefits = [
  ['Chercher chaque jour', `${PRODUCT_LIMITS.proDailySearches} recherches quotidiennes pour alimenter régulièrement votre prospection.`],
  ['Construire plusieurs listes', 'Organisez vos prospects dans plusieurs campagnes, au-delà de la campagne d’essai.'],
  ['Préparer vos prises de contact', 'Créez les brouillons Gmail que vous choisissez. Aucun envoi automatique.'],
  ['Emporter votre suivi', 'Exportez vos prospects en CSV pour poursuivre le travail dans vos propres outils.'],
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
        <h1>Ne laissez pas votre prospection s’arrêter après trois recherches.</h1>
        <p className={styles.lead}>
          ProspectTube Pro aide les MiniMakers et monteurs vidéo à trouver de nouveaux créateurs actifs chaque jour,
          construire plusieurs listes et préparer leur prospection sans perdre le fil.
        </p>
        <div className={styles.priceLine}>
          <strong>{PRO_MONTHLY_PRICE_LABEL}</strong><span>/ mois</span>
        </div>
        <p className={styles.billingNote}>Facturation mensuelle, sans engagement. Annulation depuis le portail Stripe.</p>
        <ProCheckoutButton authenticated={Boolean(session)} isPro={plan === 'Pro'} />
      </section>

      <section className={styles.benefits} aria-labelledby="benefits-title">
        <div className={styles.sectionHeading}>
          <p>Ce que Pro change</p>
          <h2 id="benefits-title">Un rythme de prospection régulier, pas seulement plus de fonctionnalités.</h2>
        </div>
        <div className={styles.benefitGrid}>
          {proBenefits.map(([title, text], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.planChoice} aria-labelledby="plan-choice-title">
        <div>
          <p className={styles.eyebrow}>Gratuit ou Pro</p>
          <h2 id="plan-choice-title">Commencez gratuitement. Passez Pro quand la recherche devient une habitude.</h2>
        </div>
        <div className={styles.planSummary}>
          <article>
            <span>Gratuit</span>
            <strong>Pour valider votre ciblage</strong>
            <p>{PRODUCT_LIMITS.freeLifetimeSearches} recherches à vie · {PRODUCT_LIMITS.freeCampaigns} campagne · {PRODUCT_LIMITS.freeCampaignProspects} prospects maximum</p>
          </article>
          <article className={styles.proSummary}>
            <span>Pro</span>
            <strong>Pour prospecter chaque semaine</strong>
            <p>{PRODUCT_LIMITS.proDailySearches} recherches par jour · campagnes supplémentaires · brouillons Gmail · export CSV</p>
          </article>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div><p>Prêt à prospecter régulièrement ?</p><h2>Passez à 5 recherches par jour.</h2></div>
        <ProCheckoutButton authenticated={Boolean(session)} isPro={plan === 'Pro'} />
      </section>
    </main>
  )
}
