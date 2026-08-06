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

const benefits = [
  ['⌕', 'Moins de temps à chercher'],
  ['↗', 'Des prospects classés par potentiel'],
  ['@', 'Des coordonnées publiques quand elles existent'],
  ['✓', 'Une campagne prête à organiser'],
  ['✉', 'Des brouillons Gmail sans quitter ton workflow'],
]

const steps = [
  {
    number: '01',
    title: 'Définis ta cible',
    description: 'Choisis une niche, une sous-niche, une langue et une audience adaptée à ton offre.',
    visual: (
      <div className={styles.targetMini} aria-hidden="true">
        <span>Gaming</span><span>Fortnite</span><span>Français</span><span>10K–100K</span>
      </div>
    ),
  },
  {
    number: '02',
    title: 'Analyse les prospects',
    description: 'Compare les performances récentes, l’activité et le potentiel de production estimé.',
    visual: (
      <div className={styles.prospectMini} aria-hidden="true">
        <div className={styles.miniAvatar}>MV</div>
        <div><strong>Motionverse</strong><span>Potentiel élevé · 84/100</span></div>
      </div>
    ),
  },
  {
    number: '03',
    title: 'Organise ta campagne',
    description: 'Ajoute tes prospects, personnalise tes messages et crée tes brouillons Gmail.',
    visual: (
      <div className={styles.campaignMini} aria-hidden="true">
        <span><i />5 prospects</span><span><i />3 messages prêts</span><b>Brouillons Gmail</b>
      </div>
    ),
  },
]

const faqs = [
  ['Est-ce que ProspectTube garantit qu’un créateur cherche un monteur ?', 'Non. Le score estime un potentiel à partir de signaux publics. Il ne garantit ni un besoin, ni une réponse, ni une vente.'],
  ['Comment sont trouvés les emails ?', 'ProspectTube analyse les coordonnées rendues publiques dans les descriptions de chaîne et de vidéos déjà accessibles via YouTube.'],
  ['Pourquoi certains prospects n’ont-ils pas d’email ?', 'Certains créateurs ne publient aucune adresse ou utilisent une adresse protégée par YouTube. ProspectTube ne contourne jamais ces protections.'],
  ['Comment fonctionne le score ?', 'Il aide à prioriser selon les performances récentes, l’activité, la fréquence, la pertinence et le potentiel de montage estimé. La contactabilité reste séparée.'],
  ['Combien de recherches sont incluses ?', `Le plan Gratuit comprend ${PRODUCT_LIMITS.freeLifetimeSearches} recherches réussies à vie. Le plan Pro comprend ${PRODUCT_LIMITS.proDailySearches} recherches réussies par jour.`],
  ['Est-ce que Gmail envoie les messages automatiquement ?', 'Non. ProspectTube crée uniquement les brouillons que tu as rédigés. Tu gardes la main dans Gmail avant tout envoi.'],
  ['Puis-je annuler mon abonnement ?', 'Oui. Le Plan Pro est sans engagement et peut être annulé depuis le portail Stripe.'],
  ['Est-ce adapté aux MediaMakers et agences ?', 'Oui. Les signaux de production et l’organisation en campagnes peuvent aussi servir aux MediaMakers, motion designers, freelances et agences.'],
]

export default function LandingPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const plan = (session?.user as any)?.plan || 'Gratuit'

  const startFree = () => router.push(session ? '/dashboard/home' : '/register')

  const openPro = async () => {
    if (!session) return router.push('/register')
    if (isPro(plan)) return router.push('/dashboard/home')

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
      <nav className={styles.nav} aria-label="Navigation principale">
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo} aria-label="ProspectTube, accueil">Prospect<span>Tube</span></Link>
          <div className={styles.navLinks}>
            <a href="#recherche">Recherche</a>
            <a href="#score">Score</a>
            <a href="#campagnes">Campagnes</a>
            <a href="#tarifs">Tarifs</a>
          </div>
          <div className={styles.navActions}>
            <Link href={session ? '/dashboard/home' : '/login'} className={styles.navSecondary}>
              {session ? 'Dashboard' : 'Connexion'}
            </Link>
            <button onClick={startFree} className={styles.navPrimary}>{session ? 'Ouvrir l’app' : 'Tester gratuitement'}</button>
          </div>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><span /> Prospection YouTube pour monteurs et créatifs</div>
            <h1>Trouve des créateurs YouTube à prospecter, plus vite.</h1>
            <p>
              ProspectTube analyse des signaux publics pour t’aider à identifier, classer et organiser des créateurs pertinents selon ta niche, leur activité et leur potentiel de production.
            </p>
            <div className={styles.heroActions}>
              <button onClick={startFree} className={styles.primaryButton}>Trouver mes premiers prospects</button>
              <a href="#comment-ca-marche" className={styles.secondaryButton}>Découvrir ProspectTube</a>
            </div>
            <div className={styles.heroNote}>3 recherches gratuites <i /> 1 campagne d’essai <i /> sans carte bancaire</div>
          </div>

          <div className={styles.deviceStage} aria-label="Aperçu de l’interface ProspectTube">
            <div className={styles.macbook}>
              <div className={styles.camera} />
              <div className={styles.screen}>
                <Image src="/images/dashboard-preview.png" alt="Dashboard ProspectTube avec recherche ciblée et cartes de prospects" fill priority sizes="(max-width: 900px) 92vw, 54vw" />
              </div>
            </div>
            <div className={styles.macbookBase}><span /></div>
            <div className={`${styles.floatingSignal} ${styles.signalScore}`}><span>Prospect Score</span><strong>84/100</strong></div>
            <div className={`${styles.floatingSignal} ${styles.signalCampaign}`}><span>Campagne</span><strong>5 prospects</strong></div>
          </div>
        </div>
      </section>

      <section className={styles.benefitStrip} aria-label="Bénéfices ProspectTube">
        <div className={styles.sectionInner}>
          {benefits.map(([icon, text]) => <div key={text}><span>{icon}</span><p>{text}</p></div>)}
        </div>
      </section>

      <section id="comment-ca-marche" className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeading}>
            <span>Un workflow simple</span>
            <h2>De ta cible à ta campagne, sans disperser tes recherches.</h2>
            <p>Chaque étape reste lisible, actionnable et sous ton contrôle.</p>
          </div>
          <div className={styles.stepGrid}>
            {steps.map(step => (
              <article key={step.number} className={styles.stepCard}>
                <div className={styles.stepHeader}><span>{step.number}</span><i /></div>
                <h3>{step.title}</h3><p>{step.description}</p>
                <div className={styles.stepVisual}>{step.visual}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="recherche" className={`${styles.section} ${styles.sectionBand}`}>
        <div className={`${styles.sectionInner} ${styles.showcaseGrid}`}>
          <div className={styles.showcaseCopy}>
            <span className={styles.kicker}>Recherche ciblée</span>
            <h2>Des critères simples. Des résultats réellement exploitables.</h2>
            <p>Définis la niche, la sous-niche, la langue et la taille de chaîne. ProspectTube classe les résultats par score et fait tourner les profils pour t’aider à découvrir de nouveaux prospects.</p>
            <p className={styles.highlightText}>ProspectTube ne se contente pas du nom de la chaîne : il s’appuie sur le contenu récent, l’activité et les performances publiques.</p>
            <ul className={styles.checkList}><li>Niche et sous-niche</li><li>Langue et abonnés</li><li>Rotation vers de nouveaux prospects</li><li>Résultats classés par score</li></ul>
          </div>
          <div className={styles.searchPanel} aria-label="Exemple de recherche ciblée">
            <div className={styles.panelBar}><span>Nouvelle recherche</span><i>3 critères actifs</i></div>
            <div className={styles.fieldGrid}><label>Niche<strong>Gaming</strong></label><label>Sous-niche<strong>Fortnite</strong></label><label>Langue<strong>Français</strong></label><label>Abonnés<strong>10K – 100K</strong></label></div>
            <div className={styles.resultRow}><div className={styles.resultAvatar}>CL</div><div><strong>Creator Lab</strong><span>42K abonnés · active cette semaine</span></div><b>82/100</b></div>
            <div className={styles.resultRow}><div className={styles.resultAvatar}>VM</div><div><strong>Video Mode</strong><span>68K abonnés · contact public</span></div><b>77/100</b></div>
          </div>
        </div>
      </section>

      <section id="score" className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeading}>
            <span>Priorisation honnête</span>
            <h2>La qualité du prospect et la facilité de contact ne sont pas la même chose.</h2>
          </div>
          <div className={styles.scoreSplit}>
            <article className={styles.scorePanel}>
              <div className={styles.scorePanelTop}><div><span>Prospect Score</span><strong>84<small>/100</small></strong></div><b>Potentiel élevé</b></div>
              <ul><li>Performances récentes</li><li>Activité et fréquence</li><li>Potentiel de montage estimé</li><li>Pertinence de la cible</li></ul>
            </article>
            <article className={styles.contactPanel}>
              <div><span>Contactabilité</span><strong>Moyenne</strong></div>
              <div className={styles.contactTags}><span>Email public</span><span>Instagram</span><span>Site</span></div>
              <p>Les points de contact restent séparés du score commercial.</p>
            </article>
          </div>
          <p className={styles.honestyNote}>Le score aide à prioriser. Il ne garantit ni un besoin, ni une réponse, ni une vente.</p>
        </div>
      </section>

      <section id="campagnes" className={`${styles.section} ${styles.sectionBand}`}>
        <div className={`${styles.sectionInner} ${styles.showcaseGrid} ${styles.reverseGrid}`}>
          <div className={styles.campaignPanel} aria-label="Exemple de campagne ProspectTube">
            <div className={styles.panelBar}><span>Campagne Monteurs Gaming</span><i>Brouillon</i></div>
            <div className={styles.campaignProgress}><span className={styles.done}>1</span><i /><span className={styles.done}>2</span><i /><span>3</span></div>
            <div className={styles.editorRow}><div className={styles.resultAvatar}>CL</div><div><strong>Creator Lab</strong><span>contact@creator.fr</span></div><b>Message prêt</b></div>
            <div className={styles.editorFields}><span>Objet : Une idée pour tes prochains montages</span><p>Bonjour, j’ai regardé tes dernières vidéos et préparé une approche personnalisée…</p></div>
            <div className={styles.draftButton}>Créer le brouillon Gmail</div>
          </div>
          <div className={styles.showcaseCopy}>
            <span className={styles.kicker}>Campagnes</span>
            <h2>Prépare ta prospection sans perdre le contrôle du message.</h2>
            <p>Ajoute les prospects sélectionnés, personnalise chaque message, connecte Gmail et crée les brouillons lorsque tout est prêt.</p>
            <ol className={styles.workflowList}><li><span>1</span>Ajouter les prospects</li><li><span>2</span>Personnaliser les messages</li><li><span>3</span>Créer les brouillons Gmail</li><li><span>4</span>Suivre l’organisation de la campagne</li></ol>
            <p className={styles.highlightText}>Aucun envoi automatique : tu relis et envoies depuis Gmail.</p>
          </div>
        </div>
      </section>

      <section id="tarifs" className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={`${styles.sectionHeading} ${styles.centerHeading}`}><span>Tarifs clairs</span><h2>Commence gratuitement. Passe Pro quand ton workflow est prêt.</h2></div>
          <div className={styles.pricingGrid}>
            <article className={styles.priceCard}>
              <div className={styles.priceName}>Gratuit</div><div className={styles.price}><strong>0 €</strong><span>/mois</span></div><p>Pour tester ton premier workflow de prospection.</p>
              <ul><li>{PRODUCT_LIMITS.freeLifetimeSearches} recherches réussies à vie</li><li>{PRODUCT_LIMITS.freeCampaigns} campagne d’essai</li><li>Jusqu’à {PRODUCT_LIMITS.freeCampaignProspects} prospects</li><li>Favoris et historique</li><li>Aucun paiement requis</li></ul>
              <button onClick={startFree} className={styles.priceSecondary}>Tester gratuitement</button>
            </article>
            <article className={`${styles.priceCard} ${styles.priceFeatured}`}>
              <div className={styles.popularBadge}>Plan recommandé</div><div className={styles.priceName}>Pro</div><div className={styles.price}><strong>{PRO_MONTHLY_PRICE_LABEL}</strong><span>/mois</span></div><p>Pour prospecter régulièrement et organiser plusieurs campagnes.</p>
              <ul><li>{PRODUCT_LIMITS.proDailySearches} recherches réussies par jour</li><li>Campagnes supplémentaires</li><li>Rotation vers de nouveaux prospects</li><li>Score orienté montage et emails publics</li><li>Brouillons Gmail, favoris et historique</li></ul>
              <button onClick={openPro} disabled={checkoutLoading} className={styles.pricePrimary}>{checkoutLoading ? 'Ouverture de Stripe…' : isPro(plan) ? 'Accéder au dashboard' : 'Passer au Pro'}</button>
              {checkoutError && <div className={styles.checkoutError} role="alert">{checkoutError}</div>}
            </article>
          </div>
        </div>
      </section>

      <section id="faq" className={`${styles.section} ${styles.faqSection}`}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeading}><span>Questions fréquentes</span><h2>Ce que ProspectTube fait — et ce qu’il ne prétend pas faire.</h2></div>
          <div className={styles.faqList}>{faqs.map(([question, answer]) => <details key={question} className={styles.faqItem}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div><span>3 recherches gratuites · sans carte bancaire</span><h2>Transforme ta prochaine recherche YouTube en liste de prospection claire.</h2></div>
        <button onClick={startFree} className={styles.primaryButton}>Trouver mes premiers prospects</button>
      </section>

      <p className={styles.publicDataNote}>ProspectTube analyse des données publiques. Les coordonnées et opportunités ne sont pas garanties.</p>
      <LegalFooter />
    </main>
  )
}
