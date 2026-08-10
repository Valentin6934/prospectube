import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/favorites', '/history', '/campaigns', '/settings'],
    },
    sitemap: 'https://www.prospectube.fr/sitemap.xml',
    host: 'https://www.prospectube.fr',
  }
}
