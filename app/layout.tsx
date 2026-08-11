import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const description =
  'ProspectTube aide les MiniMakers et monteurs vidéo à trouver des YouTubers actifs à prospecter, analyser leurs informations publiques et organiser une liste de prospects.'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.prospectube.fr'),
  applicationName: 'ProspectTube',
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
      <body className={`${inter.variable} ${spaceGrotesk.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
