import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/favorites', '/history', '/campaigns', '/settings'],
    },
    sitemap: 'https://prospectube.vercel.app/sitemap.xml',
    host: 'https://prospectube.vercel.app',
  }
}
