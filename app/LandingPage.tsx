'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import LegalFooter from '@/components/LegalFooter'
import { isPro } from '@/lib/plan'
import { PRODUCT_LIMITS, PRO_MONTHLY_PRICE_LABEL } from '@/lib/product'
import styles from './landing.module.css'

const benefits = [
  ['⌕', 'Moins de temps à chercher'],
  ['↗', 'Des chaînes actives classées par potentiel'],
  ['@', 'Des coordonnées publiques quand elles existent'],
  ['✓', 'Une liste plus rapide à évaluer'],
  ['✉', 'Des prospects prêts à organiser'],
]

const steps = [
  {
    number: '01',
    title: 'Définissez votre cible',
    description: 'Choisissez une niche, une sous-niche, une langue et une audience adaptée à votre offre.',
    visual: (
      <div className={styles.targetMini} aria-hidden="true">
        <span>Gaming</span><span>Fortnite</span><span>Français</span><span>10K–100K</span>
      </div>
    ),
  },
  {
    number: '02',
    title: 'Analysez les prospects',
    description: 'Comparez les performances récentes, l’activité et le potentiel de production estimé.',
    visual: (
      <div className={styles.prospectMini} aria-hidden="true">
        <div className={styles.miniAvatar}>MV</div>
        <div><strong>Motionverse</strong><span>Potentiel élevé · 84/100</span></div>
      </div>
    ),
  },
  {
    number: '03',
    title: 'Organisez votre campagne',
    description: 'Ajoutez vos prospects, personnalisez vos messages et ouvrez-les dans votre messagerie.',
    visual: (
      <div className={styles.campaignMini} aria-hidden="true">
        <span><i />5 prospects</span><span><i />3 messages prêts</span><b>Prêts à contacter</b>
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
  ['ProspectTube se connecte-t-il à ma boîte mail ?', 'Non. ProspectTube ouvre simplement Gmail ou votre client mail avec le message prérempli. Vous gardez la main avant tout envoi.'],
  ['Puis-je annuler mon abonnement ?', 'Oui. Le Plan Pro est sans engagement et peut être annulé depuis le portail Stripe.'],
  ['À qui s’adresse ProspectTube ?', 'ProspectTube est conçu pour les MiniMakers et monteurs vidéo qui cherchent des YouTubers actifs à prospecter pour proposer leurs services.'],
]

export default function LandingPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const plan = (session?.user as any)?.plan || 'Gratuit'

  const startFree = () => router.push(session ? '/dashboard/home' : '/register')

  const openPro = () => {
    if (!session) return router.push('/register')
    if (isPro(plan)) return router.push('/dashboard/home')
    router.push('/pro')
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
            <div className={styles.eyebrow}><span /> Pour les MiniMakers et monteurs vidéo</div>
            <h1>ProspectTube aide les MiniMakers et monteurs vidéo à trouver des YouTubers actifs à prospecter.</h1>
            <p>
              Ciblez une niche, comparez l’activité récente et organisez vos meilleurs prospects sans parcourir YouTube pendant des heures.
            </p>
            <div className={styles.heroActions}>
              <button onClick={startFree} className={styles.primaryButton}>Commencer une recherche</button>
              <a href="#comment-ca-marche" className={styles.secondaryButton}>Voir comment ça marche</a>
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
            <span>Un parcours simple</span>
            <h2>De votre spécialité à une liste de YouTubers à prospecter.</h2>
            <p>Vous gardez le contrôle sur la cible, les contacts retenus et chaque message.</p>
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
            <p>Définissez la niche, la sous-niche, la langue et la taille de chaîne. ProspectTube classe les résultats par score et fait tourner les profils pour vous aider à découvrir de nouveaux prospects.</p>
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
            <div className={styles.draftButton}>Ouvrir dans Gmail</div>
          </div>
          <div className={styles.showcaseCopy}>
            <span className={styles.kicker}>Campagnes</span>
            <h2>Préparez votre prospection sans perdre le contrôle du message.</h2>
            <p>Ajoutez les prospects sélectionnés et personnalisez chaque message. Aucune connexion Google n’est nécessaire : ProspectTube ouvre simplement votre messagerie avec les champs préremplis.</p>
            <ol className={styles.workflowList}><li><span>1</span>Ajouter les prospects</li><li><span>2</span>Personnaliser les messages</li><li><span>3</span>Ouvrir dans sa messagerie</li><li><span>4</span>Suivre l’organisation de la campagne</li></ol>
            <p className={styles.highlightText}>Aucun envoi automatique : vous relisez et envoyez vous-même.</p>
          </div>
        </div>
      </section>

      <section id="tarifs" className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={`${styles.sectionHeading} ${styles.centerHeading}`}><span>Tarifs clairs</span><h2>Commencez gratuitement. Passez Pro quand vous prospectez régulièrement.</h2></div>
          <div className={styles.pricingGrid}>
            <article className={styles.priceCard}>
              <div className={styles.priceName}>Gratuit</div><div className={styles.price}><strong>0 €</strong><span>/mois</span></div><p>Pour tester votre première recherche et organiser vos premiers prospects.</p>
              <ul><li>{PRODUCT_LIMITS.freeLifetimeSearches} recherches réussies à vie</li><li>{PRODUCT_LIMITS.freeCampaigns} campagne d’essai</li><li>Jusqu’à {PRODUCT_LIMITS.freeCampaignProspects} prospects</li><li>Favoris et historique</li><li>Aucun paiement requis</li></ul>
              <button onClick={startFree} className={styles.priceSecondary}>Tester gratuitement</button>
            </article>
            <article className={`${styles.priceCard} ${styles.priceFeatured}`}>
              <div className={styles.popularBadge}>Pour prospecter chaque jour</div><div className={styles.priceName}>Pro</div><div className={styles.price}><strong>{PRO_MONTHLY_PRICE_LABEL}</strong><span>/mois</span></div><p>Pour prospecter régulièrement et organiser plusieurs campagnes.</p>
              <ul><li>{PRODUCT_LIMITS.proDailySearches} recherches réussies par jour</li><li>Campagnes supplémentaires</li><li>Rotation vers de nouveaux prospects</li><li>Score orienté montage et emails publics</li><li>Passage à la messagerie, favoris et historique</li></ul>
              <button onClick={openPro} className={styles.pricePrimary}>{isPro(plan) ? 'Accéder au dashboard' : 'Découvrir le Plan Pro'}</button>
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
        <div><span>3 recherches gratuites · sans carte bancaire</span><h2>Transformez votre prochaine recherche YouTube en liste de prospection claire.</h2></div>
        <button onClick={startFree} className={styles.primaryButton}>Essayer ProspectTube</button>
      </section>

      <p className={styles.publicDataNote}>ProspectTube analyse des données publiques. Les coordonnées et opportunités ne sont pas garanties.</p>
      <LegalFooter />
    </main>
  )
}
