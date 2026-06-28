import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

const description =
  'Trouvez des créateurs YouTube à contacter avec emails, réseaux sociaux, IA et campagnes.'

export const metadata: Metadata = {
  metadataBase: new URL('https://prospectube.vercel.app'),
  title: {
    default: 'ProspectTube',
    template: '%s | ProspectTube',
  },
  description,
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: '/',
    siteName: 'ProspectTube',
    title: 'ProspectTube',
    description,
    images: [
      {
        url: '/images/dashboard-preview.png',
        width: 1536,
        height: 1024,
        alt: 'Interface ProspectTube pour trouver des créateurs YouTube',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ProspectTube',
    description,
    images: ['/images/dashboard-preview.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
