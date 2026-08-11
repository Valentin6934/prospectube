import type { Metadata } from 'next'
import LandingPage from './LandingPage'

const title = 'ProspectTube — Prospection YouTube pour MiniMakers et monteurs vidéo'
const description =
  'ProspectTube aide les MiniMakers et monteurs vidéo à trouver des YouTubers actifs à prospecter, analyser leurs informations publiques et organiser une liste de prospects.'

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
  alternates: {
    canonical: '/',
  },
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
