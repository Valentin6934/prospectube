import LegalPage, { Placeholder } from '@/components/LegalPage'

export default function LegalNoticePage() {
  return (
    <LegalPage
      title="Mentions légales"
      introduction="Les présentes mentions légales identifient l’éditeur de ProspectTube et précisent les principales informations relatives à l’exploitation du service."
    >
      <section>
        <h2>Éditeur du service</h2>
        <p><strong>Raison sociale :</strong> <Placeholder>ProspectTube</Placeholder></p>
        <p><strong>Adresse :</strong> <Placeholder>5 chemin du belvedère</Placeholder></p>
        <p><strong>SIREN/SIRET :</strong> <Placeholder>En cours d’immatriculation</Placeholder></p>
        <p><strong>Email :</strong> <Placeholder>barjouvalentin@gmail.com</Placeholder></p>
      </section>

      <section>
        <h2>Responsable de la publication</h2>
        <p>Le responsable de la publication du service ProspectTube est <Placeholder>Valentin Barjou</Placeholder>.</p>
      </section>

      <section>
        <h2>Hébergement</h2>
        <p>
          Les informations relatives à l’hébergeur sont en cours de finalisation et seront publiées avant
          la mise en production du service.
        </p>
      </section>

      <section>
        <h2>Propriété intellectuelle</h2>
        <p>
          Les éléments composant ProspectTube, notamment sa marque, son interface, ses textes et son code,
          sont protégés par les règles applicables à la propriété intellectuelle. Toute reproduction ou
          exploitation non autorisée est interdite.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Pour toute question relative au service, contactez <Placeholder>barjouvalentin@gmail.com</Placeholder>.</p>
      </section>
    </LegalPage>
  )
}
