import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Politique de confidentialité de ProspectTube, notamment pour la connexion Google OAuth et la création de brouillons Gmail.',
  alternates: {
    canonical: '/privacy',
  },
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      introduction="Cette politique décrit les données traitées par ProspectTube, leur utilisation et les choix dont vous disposez. Dernière mise à jour : 9 août 2026."
    >
      <section>
        <h2>Responsable du traitement</h2>
        <p>
          ProspectTube, représenté par Valentin Barjou, est responsable des traitements décrits ci-dessous.
          Pour toute question ou demande relative à vos données, écrivez à barjouvalentin@gmail.com.
        </p>
      </section>

      <section>
        <h2>Données utilisées par ProspectTube</h2>
        <p>Selon les fonctionnalités utilisées, ProspectTube traite :</p>
        <ul>
          <li>les informations de compte fournies lors de l’inscription, notamment le nom et l’adresse email ;</li>
          <li>les critères, résultats et quotas de recherche ;</li>
          <li>les favoris, campagnes, prospects, sujets et corps de messages enregistrés ;</li>
          <li>les données techniques strictement nécessaires à la session, à la sécurité et aux parcours OAuth ;</li>
          <li>les informations d’abonnement transmises par Stripe, sans stocker le numéro complet de carte bancaire.</li>
        </ul>
      </section>

      <section>
        <h2>Connexion Google et Gmail</h2>
        <p>
          La connexion Gmail est facultative. ProspectTube demande les scopes <code>openid</code>, <code>email</code>,
          {' '}<code>profile</code> et <code>https://www.googleapis.com/auth/gmail.compose</code> afin d’identifier le
          compte Google autorisé et de créer, à votre demande, des brouillons dans ce compte Gmail.
        </p>
        <p>Lorsque vous connectez Gmail, ProspectTube traite et conserve :</p>
        <ul>
          <li>l’identifiant du compte Google et son adresse email ;</li>
          <li>les jetons OAuth d’accès et de renouvellement, leur date d’expiration et les scopes accordés ;</li>
          <li>le destinataire, le sujet et le corps du message lorsque vous demandez la création d’un brouillon ;</li>
          <li>l’identifiant technique du brouillon Gmail et son statut dans la campagne.</li>
        </ul>
        <p>
          ProspectTube n’utilise pas cet accès pour lire votre boîte de réception, vos messages reçus, vos pièces
          jointes, vos contacts ou votre historique Gmail. Aucun email n’est envoyé automatiquement : le produit
          crée un brouillon que vous pouvez contrôler, modifier ou supprimer dans Gmail avant tout envoi.
        </p>
      </section>

      <section>
        <h2>Utilisation limitée des données Google</h2>
        <p>
          Les informations reçues des API Google sont utilisées uniquement pour fournir et sécuriser la connexion
          Gmail et la création de brouillons demandée par l’utilisateur. Elles ne sont pas vendues, utilisées pour
          la publicité, ni exploitées pour établir un profil marketing. Leur utilisation et leur transfert respectent
          la Google API Services User Data Policy, y compris ses exigences de Limited Use.
        </p>
      </section>

      <section>
        <h2>Partage et sous-traitants</h2>
        <p>
          Les données peuvent être traitées par les prestataires techniques nécessaires au fonctionnement du service,
          notamment l’hébergement, la base de données, Stripe pour les paiements et Google pour les fonctions Gmail.
          Elles ne sont communiquées que pour fournir, sécuriser ou administrer ProspectTube, ou lorsque la loi l’exige.
        </p>
      </section>

      <section>
        <h2>Conservation et sécurité</h2>
        <p>
          Les données du compte et les campagnes sont conservées tant que le compte ou la fonctionnalité concernée
          reste utilisé, puis pendant la durée nécessaire aux obligations légales et de sécurité. Les identifiants
          Gmail et jetons OAuth sont supprimés de ProspectTube lorsque vous déconnectez Gmail. Des mesures techniques
          et organisationnelles raisonnables protègent les données contre les accès non autorisés.
        </p>
      </section>

      <section>
        <h2>Révoquer l’accès Google</h2>
        <p>Vous pouvez interrompre l’accès Gmail à tout moment :</p>
        <ul>
          <li>dans ProspectTube, depuis Paramètres, avec le bouton « Déconnecter Gmail » ;</li>
          <li>dans votre compte Google, rubrique Sécurité puis Connexions avec des applications tierces.</li>
        </ul>
        <p>
          La déconnexion supprime les jetons OAuth conservés par ProspectTube. Les brouillons déjà créés restent dans
          votre compte Gmail jusqu’à ce que vous les supprimiez directement dans Gmail.
        </p>
      </section>

      <section>
        <h2>Vos droits</h2>
        <p>
          Vous pouvez demander l’accès, la rectification, l’effacement, la limitation ou la portabilité de vos données,
          et vous opposer à certains traitements lorsque la loi le permet. Adressez votre demande à
          {' '}barjouvalentin@gmail.com. Vous pouvez également saisir l’autorité de contrôle compétente.
        </p>
      </section>

      <section>
        <h2>Modifications</h2>
        <p>
          Cette politique peut évoluer pour refléter les changements du service ou des exigences légales. La date de
          mise à jour affichée en haut de page permet d’identifier la version applicable.
        </p>
      </section>
    </LegalPage>
  )
}
