import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Politique de confidentialité de ProspectTube.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      introduction="Cette politique décrit les données traitées par ProspectTube, leur utilisation et les choix dont vous disposez. Dernière mise à jour : 14 août 2026."
    >
      <section>
        <h2>Responsable du traitement</h2>
        <p>ProspectTube, représenté par Valentin Barjou, est responsable des traitements décrits ci-dessous. Pour toute question, écrivez à barjouvalentin@gmail.com.</p>
      </section>

      <section>
        <h2>Données utilisées par ProspectTube</h2>
        <p>Selon les fonctionnalités utilisées, ProspectTube traite :</p>
        <ul>
          <li>les informations de compte fournies lors de l’inscription, notamment le nom et l’adresse email ;</li>
          <li>les critères, résultats et quotas de recherche ;</li>
          <li>les favoris, campagnes, prospects, sujets et corps de messages enregistrés ;</li>
          <li>les données techniques strictement nécessaires à la session et à la sécurité ;</li>
          <li>les informations d’abonnement transmises par Stripe, sans stocker le numéro complet de carte bancaire.</li>
        </ul>
      </section>

      <section>
        <h2>Messagerie et emails</h2>
        <p>
          ProspectTube ne se connecte pas à votre compte Google ou à votre boîte mail. Lorsque vous choisissez « Ouvrir dans Gmail » ou « Ouvrir dans mon client mail », le navigateur ouvre un lien prérempli avec l’adresse publique du prospect, le sujet et le message que vous avez préparés.
        </p>
        <p>
          ProspectTube ne lit pas votre boîte de réception, vos contacts, vos pièces jointes ou votre historique, ne stocke aucun jeton d’accès à une messagerie et n’envoie aucun email. Vous relisez, modifiez et envoyez vous-même depuis votre messagerie.
        </p>
      </section>

      <section>
        <h2>Partage et sous-traitants</h2>
        <p>Les données peuvent être traitées par les prestataires nécessaires au fonctionnement du service, notamment l’hébergement, la base de données et Stripe pour les paiements. Elles ne sont communiquées que pour fournir, sécuriser ou administrer ProspectTube, ou lorsque la loi l’exige.</p>
      </section>

      <section>
        <h2>Conservation et sécurité</h2>
        <p>Les données du compte et les campagnes sont conservées tant que le compte ou la fonctionnalité concernée reste utilisé, puis pendant la durée nécessaire aux obligations légales et de sécurité. Des mesures techniques et organisationnelles raisonnables protègent les données contre les accès non autorisés.</p>
      </section>

      <section>
        <h2>Vos droits</h2>
        <p>Vous pouvez demander l’accès, la rectification, l’effacement, la limitation ou la portabilité de vos données, et vous opposer à certains traitements lorsque la loi le permet. Adressez votre demande à barjouvalentin@gmail.com. Vous pouvez également saisir l’autorité de contrôle compétente.</p>
      </section>

      <section>
        <h2>Modifications</h2>
        <p>Cette politique peut évoluer pour refléter les changements du service ou des exigences légales. La date de mise à jour affichée en haut de page permet d’identifier la version applicable.</p>
      </section>
    </LegalPage>
  )
}
