import LegalPage, { Placeholder } from '@/components/LegalPage'

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      introduction="Cette politique explique quelles données ProspectTube traite, pour quelles finalités et quels droits peuvent être exercés par ses utilisateurs."
    >
      <section>
        <h2>Données collectées</h2>
        <p>ProspectTube peut traiter les informations suivantes :</p>
        <ul>
          <li>les données du compte utilisateur, notamment le nom et l’adresse email ;</li>
          <li>les paramètres et résultats des recherches effectuées ;</li>
          <li>les chaînes enregistrées en favoris ;</li>
          <li>les campagnes, prospects et messages créés dans le service ;</li>
          <li>les informations techniques nécessaires aux cookies de session et à la sécurité.</li>
        </ul>
      </section>

      <section>
        <h2>Finalités du traitement</h2>
        <p>
          Ces données sont utilisées pour fournir le service, sauvegarder les recherches, gérer les favoris et
          campagnes, appliquer les limites liées au plan, sécuriser les comptes et assurer le support.
        </p>
      </section>

      <section>
        <h2>Paiements Stripe</h2>
        <p>
          Les paiements et abonnements Pro sont traités par Stripe. ProspectTube ne stocke pas les numéros
          complets de carte bancaire. Stripe traite les données de paiement conformément à ses propres
          conditions et à sa politique de confidentialité.
        </p>
      </section>

      <section>
        <h2>Connexion Gmail OAuth</h2>
        <p>
          Si l’utilisateur choisit de connecter Gmail, ProspectTube conserve les jetons OAuth nécessaires à la
          création de brouillons ou à l’envoi de messages. Cette connexion est facultative et peut être
          révoquée depuis les paramètres. ProspectTube ne demande pas l’accès aux emails reçus.
        </p>
      </section>

      <section>
        <h2>Cookies et session</h2>
        <p>
          Des cookies strictement nécessaires sont utilisés pour maintenir la session, protéger
          l’authentification et sécuriser les parcours OAuth. Aucun cookie publicitaire n’est requis au
          fonctionnement principal du service.
        </p>
      </section>

      <section>
        <h2>Durée de conservation et sécurité</h2>
        <p>
          Les données sont conservées pendant la durée nécessaire à la fourniture du service et au respect des
          obligations légales. Des mesures techniques et organisationnelles raisonnables sont mises en œuvre
          pour limiter les accès non autorisés.
        </p>
      </section>

      <section>
        <h2>Vos droits</h2>
        <p>
          Vous pouvez demander l’accès, la rectification, la modification ou la suppression de vos données,
          ainsi que la limitation de certains traitements. Adressez votre demande à
          {' '}<Placeholder>[Email de contact]</Placeholder>. Une preuve d’identité pourra être demandée si
          elle est nécessaire à la protection du compte.
        </p>
      </section>

      <section>
        <h2>Responsable du traitement</h2>
        <p>
          Le responsable du traitement est <Placeholder>[Nom de l’entreprise]</Placeholder>, situé à
          {' '}<Placeholder>[Adresse]</Placeholder>.
        </p>
      </section>
    </LegalPage>
  )
}
