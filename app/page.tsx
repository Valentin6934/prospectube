import type { Metadata } from 'next'
import LandingPage from './LandingPage'

const title = 'ProspectTube — Trouvez les meilleurs créateurs YouTube à contacter'
const description = 'Analysez YouTube, trouvez les contacts publics des créateurs, évaluez leur potentiel et lancez vos campagnes de prospection.'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://prospecttube.com'),
  title,
  description,
  keywords: ['prospection YouTube', 'créateurs YouTube', 'emails créateurs', 'campagnes influenceurs'],
  openGraph: {
    title,
    description,
    type: 'website',
    locale: 'fr_FR',
    siteName: 'ProspectTube',
    images: [
      {
        url: '/images/dashboard-preview.png',
        width: 1536,
        height: 1024,
        alt: 'Interface de recherche de créateurs ProspectTube',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/images/dashboard-preview.png'],
  },
}

export default function HomePage() {
  return <LandingPage />
}
