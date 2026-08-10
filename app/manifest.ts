import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ProspectTube',
    short_name: 'ProspectTube',
    description:
      'ProspectTube aide les MiniMakers et monteurs vidéo à trouver des créateurs YouTube actifs et organiser leur prospection.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0812',
    theme_color: '#0A0812',
    lang: 'fr',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
