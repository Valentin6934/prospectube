import type { MetadataRoute } from 'next'

const baseUrl = 'https://prospectube.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: '/', changeFrequency: 'weekly', priority: 1 },
    { path: '/login', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/register', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/mentions-legales', changeFrequency: 'yearly', priority: 0.2 },
    { path: '/politique-confidentialite', changeFrequency: 'yearly', priority: 0.2 },
    { path: '/cgu', changeFrequency: 'yearly', priority: 0.2 },
    { path: '/remboursement', changeFrequency: 'yearly', priority: 0.2 },
  ] as const

  return routes.map(({ path, changeFrequency, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }))
}
