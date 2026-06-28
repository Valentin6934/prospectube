import LegalPage, { Placeholder } from '@/components/LegalPage'

export default function TermsPage() {
  return (
    <LegalPage
      title="Conditions générales d’utilisation"
      introduction="Les présentes conditions encadrent l’accès à ProspectTube et son utilisation par toute personne disposant d’un compte."
    >
      <section>
        <h2>Objet du service</h2>
        <p>
          ProspectTube fournit des outils de recherche, d’organisation et de prospection à destination des
          créateurs et professionnels. Le service peut notamment proposer des favoris, un historique, des
          campagnes et des fonctions de génération de messages.
        </p>
      </section>

      <section>
        <h2>Compte utilisateur</h2>
        <p>
          L’utilisateur doit fournir des informations exactes, conserver ses identifiants confidentiels et
          informer <Placeholder>[Nom de l’entreprise]</Placeholder> de tout accès non autorisé. Il demeure
          responsable des actions réalisées depuis son compte.
        </p>
      </section>

      <section>
        <h2>Plan Gratuit et abonnement Pro</h2>
        <p>
          Le plan Gratuit donne accès à un périmètre limité du service. L’abonnement Pro est mensuel et débloque
          les fonctionnalités premium indiquées au moment de la souscription. Les paiements et la gestion de
          l’abonnement sont assurés par Stripe.
        </p>
      </section>

      <section>
        <h2>Usage raisonnable</h2>
        <p>
          L’utilisateur s’engage à utiliser ProspectTube de manière raisonnable, conforme aux lois applicables
          et sans perturber son fonctionnement. Les tentatives de contournement des limites, d’accès non
          autorisé ou d’automatisation abusive sont interdites.
        </p>
      </section>

      <section>
        <h2>Interdiction du spam</h2>
        <p>
          ProspectTube ne doit pas être utilisé pour envoyer des communications non sollicitées en masse.
          L’utilisateur doit vérifier la licéité de ses démarches, respecter les règles de prospection
          applicables et offrir aux destinataires les moyens d’exercer leurs droits.
        </p>
      </section>

      <section>
        <h2>Responsabilité de l’utilisateur</h2>
        <p>
          L’utilisateur reste seul responsable des recherches effectuées, des prospects sélectionnés, du
          contenu des messages générés ou modifiés et des communications envoyées via Gmail ou tout autre canal.
          Il doit contrôler chaque message avant son utilisation.
        </p>
      </section>

      <section>
        <h2>Disponibilité et responsabilité du service</h2>
        <p>
          ProspectTube est fourni avec une obligation de moyens. Des interruptions peuvent intervenir pour
          maintenance, sécurité ou en raison de services tiers. <Placeholder>[Nom de l’entreprise]</Placeholder>
          ne garantit pas qu’un prospect répondra à une sollicitation.
        </p>
      </section>

      <section>
        <h2>Suspension et résiliation</h2>
        <p>
          Un compte peut être limité ou suspendu en cas d’abus, de fraude, de spam, d’atteinte à la sécurité ou
          de violation des présentes conditions. L’utilisateur peut cesser d’utiliser le service et gérer son
          abonnement depuis le portail Stripe.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Toute question peut être adressée à <Placeholder>[Email de contact]</Placeholder>.</p>
      </section>
    </LegalPage>
  )
}
