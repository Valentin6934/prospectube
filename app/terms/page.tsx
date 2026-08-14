import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Conditions d’utilisation',
  description: 'Conditions d’utilisation de ProspectTube.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Conditions d’utilisation"
      introduction="Ces conditions encadrent l’accès à ProspectTube et son utilisation. Dernière mise à jour : 14 août 2026."
    >
      <section>
        <h2>Service</h2>
        <p>ProspectTube aide à rechercher et organiser des créateurs YouTube à partir de données publiques. Le service propose notamment un Prospect Score indicatif, des favoris, un historique, des campagnes et la préparation de messages. Aucun résultat, contact, besoin commercial ou taux de réponse n’est garanti.</p>
      </section>

      <section>
        <h2>Compte utilisateur</h2>
        <p>Vous devez fournir des informations exactes, protéger vos identifiants et nous signaler tout accès non autorisé. Vous restez responsable des actions effectuées depuis votre compte ProspectTube.</p>
      </section>

      <section>
        <h2>Plans et paiement</h2>
        <p>Le plan Gratuit donne accès aux limites affichées dans le produit. Le plan Pro est proposé à 4,90 € par mois, sous réserve des informations affichées au moment de la souscription. Stripe traite les paiements et permet de gérer ou annuler l’abonnement depuis son portail.</p>
      </section>

      <section>
        <h2>Utilisation de votre messagerie</h2>
        <p>ProspectTube peut ouvrir Gmail ou votre client mail avec un destinataire, un sujet et un message préremplis. Cette action ne connecte pas votre boîte à ProspectTube et ne déclenche aucun envoi. Vous devez relire le message et décider vous-même de le modifier ou de l’envoyer depuis votre messagerie.</p>
      </section>

      <section>
        <h2>Prospection responsable</h2>
        <p>Vous êtes seul responsable du choix des prospects, du fondement légal de vos communications et du respect des règles applicables à la prospection, à la protection des données et aux communications commerciales. Le spam, les sollicitations trompeuses, l’usurpation d’identité et les envois automatisés abusifs sont interdits.</p>
      </section>

      <section>
        <h2>Usage autorisé</h2>
        <p>Vous ne devez pas contourner les limites du service, perturber son fonctionnement, accéder aux comptes ou données d’un tiers, extraire massivement le service, ni utiliser ProspectTube à des fins illégales.</p>
      </section>

      <section>
        <h2>Services tiers et disponibilité</h2>
        <p>Certaines fonctions reposent sur YouTube, Stripe, l’hébergement et la base de données. Une interruption ou une modification de ces services peut affecter ProspectTube. Le service est fourni selon une obligation de moyens et peut être temporairement interrompu pour maintenance ou sécurité.</p>
      </section>

      <section>
        <h2>Suspension et fin d’utilisation</h2>
        <p>ProspectTube peut limiter ou suspendre un compte en cas de fraude, spam, atteinte à la sécurité ou violation de ces conditions. Vous pouvez cesser d’utiliser le service et gérer votre abonnement à tout moment depuis les interfaces prévues.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Pour toute question concernant ces conditions : barjouvalentin@gmail.com.</p>
      </section>
    </LegalPage>
  )
}
