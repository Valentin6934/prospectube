'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import LegalFooter from '@/components/LegalFooter'
import { isPro } from '@/lib/plan'
import { PRODUCT_LIMITS, PRO_MONTHLY_PRICE_LABEL } from '@/lib/product'
import styles from './landing.module.css'

const features = [
  {
    icon: '🎯',
    title: 'Recherche intelligente',
    description: 'Filtrez les créateurs par niche, langue et audience pour concentrer vos efforts sur les profils pertinents.',
    accent: styles.featureViolet,
    visual: (
      <div className={styles.searchVisual}>
        <span>Gaming</span><span>10K – 300K</span><i />
      </div>
    ),
  },
  {
    icon: '🤖',
    title: 'Contacts publics',
    description: 'Repérez les emails et réseaux sociaux rendus publics par les créateurs lorsqu’ils sont disponibles.',
    accent: styles.featureCyan,
    visual: (
      <div className={styles.messageVisual}>
        <i /><i /><i /><span>Contact public</span>
      </div>
    ),
  },
  {
    icon: '📬',
    title: 'Gmail intégré',
    description: 'Connectez Gmail pour créer les brouillons préparés manuellement dans vos campagnes.',
    accent: styles.featureGreen,
    visual: (
      <div className={styles.gmailVisual}>
        <span>Gmail connecté</span><i>3</i>
      </div>
    ),
  },
  {
    icon: '⭐',
    title: 'Score Prospect',
    description: 'Estimez le potentiel de montage à partir des performances récentes, de l’activité et des formats publics.',
    accent: styles.featureAmber,
    visual: (
      <div className={styles.scoreVisual}>
        <strong>92</strong><span>Excellent prospect</span>
      </div>
    ),
  },
]

const steps = [
  ['01', 'Choisissez une niche', 'Définissez votre audience cible et vos critères.'],
  ['02', 'Analyse YouTube', 'ProspectTube enrichit et classe les chaînes.'],
  ['03', 'Sélectionnez vos prospects', 'Gardez les profils les plus prometteurs.'],
  ['04', 'Préparez vos brouillons', 'Rédigez vos messages puis créez les brouillons dans Gmail.'],
]

const faqs = [
  ['Puis-je annuler ?', 'Oui. L’abonnement Pro est sans engagement et peut être annulé à tout moment depuis le portail Stripe.'],
  ['Comment fonctionne Gmail ?', 'Vous autorisez ProspectTube via Google OAuth. L’intégration sert uniquement à créer dans Gmail les brouillons que vous avez rédigés. Aucun message n’est envoyé automatiquement.'],
  [`Pourquoi seulement ${PRO_MONTHLY_PRICE_LABEL} ?`, 'Nous avons conçu une offre simple et accessible, centrée sur la recherche, l’organisation des prospects et la préparation de brouillons Gmail.'],
  ['Les recherches sont-elles limitées ?', `Le plan Gratuit comprend ${PRODUCT_LIMITS.freeLifetimeSearches} recherches réussies au total. Le plan Pro comprend ${PRODUCT_LIMITS.proDailySearches} recherches réussies par jour.`],
]

export default function LandingPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const plan = (session?.user as any)?.plan || 'Gratuit'

  const startFree = () => router.push(session ? '/dashboard/home' : '/register')

  const openPro = async () => {
    if (!session) {
      router.push('/register')
      return
    }
    if (isPro(plan)) {
      router.push('/dashboard/home')
      return
    }

    setCheckoutLoading(true)
    setCheckoutError('')
    const response = await fetch('/api/stripe/checkout', { method: 'POST' })
    const data = await response.json().catch(() => ({}))

    if (!response.ok || typeof data.url !== 'string') {
      setCheckoutLoading(false)
      setCheckoutError(data.error || 'Impossible d’ouvrir le paiement Stripe.')
      return
    }
    window.location.assign(data.url)
  }

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo}>Prospect<span>Tube</span></Link>
          <div className={styles.navLinks}>
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#comment-ca-marche">Comment ça marche</a>
            <a href="#tarifs">Tarifs</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className={styles.navActions}>
            {session ? (
              <Link href="/dashboard/home" className={styles.navSecondary}>Dashboard</Link>
            ) : (
              <Link href="/login" className={styles.navSecondary}>Connexion</Link>
            )}
            <button onClick={startFree} className={styles.navPrimary}>
              {session ? 'Ouvrir l’app' : 'Essayer gratuitement'}
            </button>
          </div>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><span /> La prospection YouTube, enfin structurée</div>
            <h1>Trouve et organise des créateurs YouTube susceptibles d’avoir besoin de montage vidéo.</h1>
            <p>
              ProspectTube estime leur potentiel à partir de signaux publics : performances récentes, fréquence,
              activité, formats, pertinence et coordonnées publiques disponibles.
            </p>
            <div className={styles.heroActions}>
              <button onClick={startFree} className={styles.primaryButton}>Trouver mes premiers prospects</button>
              <a href="#fonctionnalites" className={styles.secondaryButton}>Découvrir ProspectTube</a>
            </div>
            <div className={styles.heroNote}>
              <span>✓ Sans carte bancaire</span>
              <span>✓ {PRODUCT_LIMITS.freeLifetimeSearches} recherches gratuites + {PRODUCT_LIMITS.freeCampaigns} campagne d’essai</span>
            </div>
          </div>

          <div id="demo" className={styles.deviceStage}>
            <div className={styles.deviceGlow} />
            <div className={styles.macbook}>
              <div className={styles.camera} />
              <div className={styles.screen}>
                <Image
                  src="/images/dashboard-preview.png"
                  alt="Aperçu du dashboard ProspectTube"
                  fill
                  priority
                  sizes="(max-width: 900px) 92vw, 62vw"
                />
              </div>
            </div>
            <div className={styles.macbookBase}><span /></div>
          </div>
        </div>
      </section>

      <section className={styles.socialProof}>
        <div className={styles.sectionInner}>
          <p>Pensé pour les agences, freelances et marques.</p>
          <div className={styles.proofStats}>
            <div><strong>12 400+</strong><span>✓ Créateurs analysés</span></div>
            <div><strong>3 800+</strong><span>✓ Emails trouvés</span></div>
            <div><strong>1 250+</strong><span>✓ Prospects organisés</span></div>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeading}>
            <span>Fonctionnalités</span>
            <h2>Tout le nécessaire pour passer de la recherche au premier contact.</h2>
            <p>Une interface conçue pour analyser vite, comparer clairement et agir sans multiplier les outils.</p>
          </div>
          <div className={styles.featureGrid}>
            {features.map(feature => (
              <article key={feature.title} className={`${styles.featureCard} ${feature.accent}`}>
                <div className={styles.featureTop}>
                  <span className={styles.featureIcon}>{feature.icon}</span>
                  <span className={styles.featureArrow}>↗</span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <div className={styles.featureVisual}>{feature.visual}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="comment-ca-marche" className={`${styles.section} ${styles.processSection}`}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeading}>
            <span>Comment ça marche</span>
            <h2>Quatre étapes. Zéro tableur improvisé.</h2>
          </div>
          <div className={styles.timeline}>
            {steps.map(([number, title, description], index) => (
              <div key={number} className={styles.step}>
                <div className={styles.stepNumber}>{number}</div>
                <h3>{title}</h3>
                <p>{description}</p>
                {index < steps.length - 1 && <span className={styles.stepArrow}>→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tarifs" className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeading}>
            <span>Tarifs</span>
            <h2>Simple pour commencer. Puissant pour prospecter.</h2>
            <p>Commencez gratuitement, puis passez Pro lorsque vous êtes prêt à accélérer.</p>
          </div>
          <div className={styles.pricingGrid}>
            <article className={styles.priceCard}>
              <div className={styles.priceName}>Gratuit</div>
              <div className={styles.price}><strong>0 €</strong><span>/mois</span></div>
              <p>Pour découvrir la prospection structurée.</p>
              <ul>
                <li>✓ {PRODUCT_LIMITS.freeLifetimeSearches} recherches réussies à vie</li>
                <li>✓ Recherche par niche, sous-niche, langue et abonnés</li>
                <li>✓ {PRODUCT_LIMITS.freeCampaigns} campagne d’essai, jusqu’à {PRODUCT_LIMITS.freeCampaignProspects} prospects</li>
                <li>✓ Messages modifiables et brouillons Gmail</li>
                <li>✓ Favoris</li>
                <li>✓ Historique</li>
              </ul>
              <button onClick={startFree} className={styles.priceSecondary}>Commencer</button>
            </article>

            <article className={`${styles.priceCard} ${styles.priceFeatured}`}>
              <div className={styles.popularBadge}>⭐ Le plus populaire</div>
              <div className={styles.priceName}>Pro</div>
              <div className={styles.price}><strong>{PRO_MONTHLY_PRICE_LABEL}</strong><span>/mois</span></div>
              <p>Pour transformer vos recherches en opportunités.</p>
              <ul>
                <li>✓ {PRODUCT_LIMITS.proDailySearches} recherches réussies par jour</li>
                <li>✓ Rotation vers de nouveaux prospects</li>
                <li>✓ Emails publics détectés quand disponibles</li>
                <li>✓ Score de potentiel de montage estimé</li>
                <li>✓ Campagnes et brouillons Gmail</li>
                <li>✓ Export CSV</li>
              </ul>
              <button onClick={openPro} disabled={checkoutLoading} className={styles.pricePrimary}>
                {checkoutLoading ? 'Ouverture de Stripe...' : isPro(plan) ? 'Accéder au dashboard' : 'Passer Pro'}
              </button>
              {checkoutError && <div className={styles.checkoutError} role="alert">{checkoutError}</div>}
            </article>
          </div>
        </div>
      </section>

      <p style={{ maxWidth: '900px', margin: '0 auto 2rem', padding: '0 1.5rem', color: '#8F86AA', textAlign: 'center', fontSize: '0.82rem', lineHeight: 1.6 }}>
        ProspectTube analyse des données publiques. Les coordonnées et opportunités ne sont pas garanties.
      </p>

      <section id="faq" className={`${styles.section} ${styles.faqSection}`}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeading}>
            <span>FAQ</span>
            <h2>Les réponses avant de commencer.</h2>
          </div>
          <div className={styles.faqList}>
            {faqs.map(([question, answer]) => (
              <details key={question} className={styles.faqItem}>
                <summary>{question}<span>+</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div>
          <span>Votre prochaine opportunité est peut-être déjà sur YouTube.</span>
          <h2>Commencez à prospecter avec plus de précision.</h2>
        </div>
        <button onClick={startFree} className={styles.primaryButton}>Trouver mes premiers prospects</button>
      </section>

      <LegalFooter />
    </main>
  )
}
