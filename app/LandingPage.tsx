"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import LegalFooter from "@/components/LegalFooter";
import ScrollMotion from "@/components/ScrollMotion";
import { isPro } from "@/lib/plan";
import { PRODUCT_LIMITS, PRO_MONTHLY_PRICE_LABEL } from "@/lib/product";
import styles from "./landing.module.css";

const faqs = [
  [
    "Le Prospect Score garantit-il qu’une chaîne cherche un monteur ?",
    "Non. Il sert à prioriser des chaînes à partir de signaux publics. Il ne garantit ni besoin, ni réponse, ni vente.",
  ],
  [
    "D’où viennent les moyens de contact ?",
    "Uniquement des coordonnées et liens publics détectés dans les données YouTube analysées. Un canal absent n’est pas inventé.",
  ],
  [
    "ProspectTube envoie-t-il les messages ?",
    "Non. ProspectTube prépare le contenu puis ouvre Gmail ou votre client mail. Vous relisez et décidez de l’envoi.",
  ],
  [
    "Qu’apporte le plan Pro ?",
    `Le plan Gratuit comprend ${PRODUCT_LIMITS.freeLifetimeSearches} recherches réussies à vie. Pro porte la limite à ${PRODUCT_LIMITS.proDailySearches} recherches réussies par jour et débloque les fonctions indiquées dans le comparatif.`,
  ],
];

export default function LandingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const plan =
    (session?.user as { plan?: string } | undefined)?.plan || "Gratuit";
  const startFree = () =>
    router.push(session ? "/dashboard/home" : "/register");
  const openPro = () => {
    if (!session) return router.push("/register");
    if (isPro(plan)) return router.push("/dashboard/home");
    router.push("/pro");
  };

  return (
    <main className={styles.page}>
      <ScrollMotion />
      <nav className={styles.nav} aria-label="Navigation principale">
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo}>
            Prospect<span>Tube</span>
          </Link>
          <div className={styles.navLinks}>
            <a href="#produit">Produit</a>
            <a href="#methode">Méthode</a>
            <a href="#tarifs">Tarifs</a>
          </div>
          <div className={styles.navActions}>
            <Link
              href={session ? "/dashboard/home" : "/login"}
              className={styles.navSecondary}
            >
              {session ? "Dashboard" : "Connexion"}
            </Link>
            <button onClick={startFree} className={styles.navPrimary}>
              {session ? "Ouvrir l’app" : "Essayer gratuitement"}
            </button>
          </div>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Pour MiniMakers et monteurs vidéo</p>
            <h1>
              Trouvez les chaînes YouTube actives que vous avez une bonne raison
              de contacter.
            </h1>
            <p className={styles.lead}>
              Tu décris les chaînes que tu recherches. ProspectTube analyse leur
              activité récente, leurs performances et les moyens de contact
              qu’elles rendent publics.
            </p>
            <div className={styles.heroActions}>
              <button onClick={startFree} className={styles.primaryButton}>
                Lancer une recherche
              </button>
              <a href="#produit" className={styles.secondaryButton}>
                Voir ce qui est analysé
              </a>
            </div>
            <p className={styles.heroNote}>
              {PRODUCT_LIMITS.freeLifetimeSearches} recherches réussies · sans
              carte bancaire
            </p>
          </div>
          <div
            className={styles.productPreview}
            data-reveal="product"
            aria-label="Aperçu du fonctionnement de la recherche"
          >
            <div className={styles.previewHeader}>
              <span>Aperçu produit</span>
              <span>Données publiques uniquement</span>
            </div>
            <div className={styles.queryLine}>
              <span>Recherche</span>
              <strong>Fitness · France · 10K–100K abonnés</strong>
            </div>
            <ol className={styles.analysisFlow}>
              <li>
                <span>01</span>
                <div>
                  <strong>Chaînes actives</strong>
                  <small>Les résultats hors cible sont écartés.</small>
                </div>
                <b>Détectées</b>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Activité récente</strong>
                  <small>Fréquence et dernières publications.</small>
                </div>
                <b>Analysée</b>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Potentiel</strong>
                  <small>Score expliqué par des signaux observables.</small>
                </div>
                <b>Évalué</b>
              </li>
              <li>
                <span>04</span>
                <div>
                  <strong>Contacts publics</strong>
                  <small>
                    Email et réseaux affichés seulement s’ils existent.
                  </small>
                </div>
                <b>Vérifiés</b>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section id="produit" className={styles.productSection}>
        <div className={styles.sectionInner}>
          <header className={styles.sectionHeading} data-reveal="section">
            <p>Le résultat utile</p>
            <h2>Une fiche de travail, pas une galerie de profils.</h2>
            <span>
              Chaque résultat rassemble ce qu’il faut pour décider si la chaîne
              mérite une approche personnalisée.
            </span>
          </header>
          <div className={styles.resultAnatomy}>
            <div className={styles.anatomyList}>
              <div>
                <span>Chaîne et cible</span>
                <p>
                  Nom réel issu de YouTube, niche, langue et taille d’audience.
                </p>
              </div>
              <div>
                <span>Rythme actuel</span>
                <p>
                  Vues médianes récentes, dernière publication et fréquence
                  observée.
                </p>
              </div>
              <div>
                <span>Prospect Score</span>
                <p>
                  Une priorité accompagnée de sa justification, jamais une
                  promesse de vente.
                </p>
              </div>
              <div>
                <span>Contactabilité</span>
                <p>Uniquement les canaux publics réellement détectés.</p>
              </div>
            </div>
            <div
              className={styles.schemaPanel}
              data-reveal="product"
              aria-label="Structure d’une fiche résultat"
            >
              <div className={styles.schemaTop}>
                <div>
                  <small>CHAÎNE YOUTUBE</small>
                  <strong>Identité issue du résultat</strong>
                </div>
                <span>
                  Prospect Score <b>—/100</b>
                </span>
              </div>
              <div className={styles.metricRow}>
                <span>
                  Abonnés<strong>Mesurés</strong>
                </span>
                <span>
                  Vues médianes<strong>Calculées</strong>
                </span>
                <span>
                  Activité<strong>Datée</strong>
                </span>
              </div>
              <div className={styles.reason}>
                <small>POURQUOI CE SCORE ?</small>
                <p>
                  Les signaux utilisés sont détaillés ici pour permettre une
                  décision humaine.
                </p>
              </div>
              <div className={styles.channels}>
                <small>CONTACTER</small>
                <span>Email</span>
                <span>Instagram</span>
                <span>Site</span>
                <em>Affichés si détectés</em>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="methode" className={styles.methodSection} data-reveal="section">
        <div className={styles.sectionInner}>
          <header className={styles.sectionHeading}>
            <p>Du ciblage au message</p>
            <h2>Quatre étapes, avec une décision humaine à chaque passage.</h2>
          </header>
          <ol className={styles.methodList}>
            <li data-reveal="item">
              <span>01</span>
              <div>
                <h3>Trouver</h3>
                <p>Définissez niche, langue, audience et sous-niches.</p>
              </div>
            </li>
            <li data-reveal="item">
              <span>02</span>
              <div>
                <h3>Évaluer</h3>
                <p>Comparez activité, performances et raison du score.</p>
              </div>
            </li>
            <li data-reveal="item">
              <span>03</span>
              <div>
                <h3>Contacter</h3>
                <p>Utilisez seulement les coordonnées publiques disponibles.</p>
              </div>
            </li>
            <li data-reveal="item">
              <span>04</span>
              <div>
                <h3>Organiser</h3>
                <p>
                  Regroupez les prospects et préparez vos messages avant de les
                  ouvrir dans votre messagerie.
                </p>
              </div>
            </li>
          </ol>
          <p className={styles.disclosure}>
            ProspectTube ne se connecte pas à votre boîte mail et n’envoie rien
            à votre place.
          </p>
        </div>
      </section>

      <section id="tarifs" className={styles.pricingSection} data-reveal="section">
        <div className={styles.sectionInner}>
          <div className={styles.pricingIntro}>
            <p>Quand passer Pro ?</p>
            <h2>
              Quand la limite gratuite interrompt un vrai rythme de prospection.
            </h2>
            <span>
              Le produit reste utilisable gratuitement pour vérifier que le
              ciblage et les résultats vous conviennent.
            </span>
          </div>
          <div className={styles.planTable}>
            <div>
              <strong>Gratuit</strong>
              <b>0 €</b>
              <span>
                {PRODUCT_LIMITS.freeLifetimeSearches} recherches réussies à vie
              </span>
              <span>{PRODUCT_LIMITS.freeCampaigns} campagne d’essai</span>
              <button onClick={startFree} className={styles.secondaryButton}>
                Tester le produit
              </button>
            </div>
            <div>
              <strong>Pro</strong>
              <b>
                {PRO_MONTHLY_PRICE_LABEL}
                <small>/mois</small>
              </b>
              <span>
                {PRODUCT_LIMITS.proDailySearches} recherches réussies par jour
              </span>
              <span>Campagnes supplémentaires et export CSV</span>
              <button onClick={openPro} className={styles.primaryButton}>
                {isPro(plan) ? "Accéder au dashboard" : "Voir le plan Pro"}
              </button>
            </div>
          </div>
        </div>
      </section>
      <section className={styles.faqSection} data-reveal="section">
        <div className={styles.sectionInner}>
          <header className={styles.sectionHeading}>
            <p>Limites claires</p>
            <h2>Ce que ProspectTube fait — et ne prétend pas faire.</h2>
          </header>
          <div className={styles.faqList}>
            {faqs.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span>+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <section className={styles.finalCta} data-reveal="cta">
        <div>
          <p>Commencer par une cible précise</p>
          <h2>Décrivez les chaînes que vous voulez contacter.</h2>
        </div>
        <button onClick={startFree} className={styles.primaryButton}>
          Lancer une recherche
        </button>
      </section>
      <p className={styles.publicDataNote}>
        Données publiques analysées. Aucune opportunité ni réponse n’est
        garantie.
      </p>
      <LegalFooter />
    </main>
  );
}
