import type { Metadata } from 'next'
import LandingPage from './LandingPage'

const title = 'ProspectTube — Trouvez des créateurs YouTube à prospecter'
const description =
  'Trouvez et organisez des créateurs YouTube susceptibles d’avoir besoin de montage grâce à des signaux et coordonnées publics.'

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
