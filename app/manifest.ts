import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ProspectTube',
    short_name: 'ProspectTube',
    description:
      'Trouvez des créateurs YouTube à contacter avec emails, réseaux sociaux, IA et campagnes.',
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
