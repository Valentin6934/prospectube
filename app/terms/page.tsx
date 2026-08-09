import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Conditions d’utilisation',
  description: 'Conditions d’utilisation de ProspectTube et de son intégration Gmail.',
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Conditions d’utilisation"
      introduction="Ces conditions encadrent l’accès à ProspectTube et son utilisation. Dernière mise à jour : 9 août 2026."
    >
      <section>
        <h2>Service</h2>
        <p>
          ProspectTube aide à rechercher et organiser des créateurs YouTube à partir de données publiques. Le service
          propose notamment un Prospect Score indicatif, des favoris, un historique, des campagnes et la préparation
          de brouillons Gmail. Aucun résultat, contact, besoin commercial ou taux de réponse n’est garanti.
        </p>
      </section>

      <section>
        <h2>Compte utilisateur</h2>
        <p>
          Vous devez fournir des informations exactes, protéger vos identifiants et nous signaler tout accès non
          autorisé. Vous restez responsable des actions effectuées depuis votre compte ProspectTube.
        </p>
      </section>

      <section>
        <h2>Plans et paiement</h2>
        <p>
          Le plan Gratuit donne accès aux limites affichées dans le produit. Le plan Pro est proposé à 4,90 € par mois,
          sous réserve des informations affichées au moment de la souscription. Stripe traite les paiements et permet
          de gérer ou annuler l’abonnement depuis son portail.
        </p>
      </section>

      <section>
        <h2>Connexion Gmail</h2>
        <p>
          Vous pouvez connecter volontairement un compte Google afin de créer des brouillons Gmail depuis vos campagnes.
          ProspectTube utilise le scope <code>https://www.googleapis.com/auth/gmail.compose</code> uniquement pour les
          fonctions prévues par le produit. Vous contrôlez le destinataire, le sujet et le contenu du message.
        </p>
        <p>
          ProspectTube ne lit pas votre boîte de réception et n’envoie pas automatiquement les brouillons. Vous devez
          relire chaque brouillon dans Gmail et décider vous-même de le modifier, de le supprimer ou de l’envoyer.
          Vous pouvez révoquer l’autorisation depuis les Paramètres ProspectTube ou votre compte Google.
        </p>
      </section>

      <section>
        <h2>Prospection responsable</h2>
        <p>
          Vous êtes seul responsable du choix des prospects, du fondement légal de vos communications et du respect des
          règles applicables à la prospection, à la protection des données et aux communications commerciales. Le spam,
          les sollicitations trompeuses, l’usurpation d’identité et les envois automatisés abusifs sont interdits.
        </p>
      </section>

      <section>
        <h2>Usage autorisé</h2>
        <p>
          Vous ne devez pas contourner les limites du service, perturber son fonctionnement, accéder aux comptes ou
          données d’un tiers, extraire massivement le service, ni utiliser ProspectTube à des fins illégales.
        </p>
      </section>

      <section>
        <h2>Services tiers et disponibilité</h2>
        <p>
          Certaines fonctions reposent sur YouTube, Google, Gmail, Stripe, l’hébergement et la base de données. Une
          interruption ou une modification de ces services peut affecter ProspectTube. Le service est fourni selon une
          obligation de moyens et peut être temporairement interrompu pour maintenance ou sécurité.
        </p>
      </section>

      <section>
        <h2>Suspension et fin d’utilisation</h2>
        <p>
          ProspectTube peut limiter ou suspendre un compte en cas de fraude, spam, atteinte à la sécurité ou violation
          de ces conditions. Vous pouvez cesser d’utiliser le service, déconnecter Gmail et gérer votre abonnement à
          tout moment depuis les interfaces prévues.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Pour toute question concernant ces conditions : barjouvalentin@gmail.com.</p>
      </section>
    </LegalPage>
  )
}
