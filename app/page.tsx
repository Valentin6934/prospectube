import type { Metadata } from 'next'
import LandingPage from './LandingPage'

const title = 'ProspectTube — Trouvez des créateurs YouTube à contacter'
const description =
  'Trouvez les meilleurs créateurs YouTube, leurs emails et réseaux sociaux, puis organisez vos campagnes de prospection avec ProspectTube.'

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
  keywords: ['prospection YouTube', 'créateurs YouTube', 'emails créateurs', 'campagnes influenceurs'],
  openGraph: {
    title,
    description,
    type: 'website',
    url: '/',
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
