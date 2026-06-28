import LegalPage, { Placeholder } from '@/components/LegalPage'

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Politique d’annulation et de remboursement"
      introduction="Cette politique décrit les modalités applicables à l’abonnement mensuel ProspectTube Pro."
    >
      <section>
        <h2>Abonnement mensuel</h2>
        <p>
          ProspectTube Pro est facturé mensuellement au tarif affiché lors de la souscription. L’abonnement se
          renouvelle automatiquement à chaque échéance jusqu’à son annulation.
        </p>
      </section>

      <section>
        <h2>Annulation</h2>
        <p>
          L’utilisateur peut annuler son abonnement à tout moment depuis le portail de facturation Stripe,
          accessible depuis son dashboard. Sauf indication contraire, les fonctionnalités Pro restent
          disponibles jusqu’à la fin de la période déjà payée.
        </p>
      </section>

      <section>
        <h2>Remboursement du mois en cours</h2>
        <p>
          L’annulation ne déclenche pas automatiquement le remboursement du mois en cours. Les périodes
          commencées restent en principe dues, sauf obligation légale contraire ou situation exceptionnelle
          examinée par le support.
        </p>
      </section>

      <section>
        <h2>Situations exceptionnelles</h2>
        <p>
          Une demande peut être étudiée notamment en cas de double facturation, d’erreur manifeste ou
          d’indisponibilité prolongée imputable au service. Toute décision est prise après vérification des
          circonstances et des informations de paiement.
        </p>
      </section>

      <section>
        <h2>Contacter le support</h2>
        <p>
          Pour soumettre une demande, écrivez à <Placeholder>[Email de contact]</Placeholder> en précisant
          l’adresse email du compte, la date du paiement et le motif de la demande.
        </p>
      </section>
    </LegalPage>
  )
}
