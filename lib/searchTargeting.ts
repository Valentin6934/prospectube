export const SEARCH_LANGUAGES = ['Français', 'Anglais', 'Espagnol', 'Allemand', 'Italien', 'Portugais'] as const

export const NICHE_CONFIG = {
  Gaming: ['Minecraft', 'Fortnite', 'Roblox', 'GTA', 'Call of Duty', 'Valorant', 'League of Legends', 'EA Sports FC', 'Jeux indépendants', 'Nintendo', 'PlayStation', 'Xbox', 'Jeux mobiles', 'Speedrun', 'Actualité gaming', 'Tests de jeux', 'Streaming'],
  Immobilier: ['Investissement locatif', 'Agents immobiliers', 'Visites de biens', 'Rénovation', 'Architecture', 'Décoration', 'Location courte durée', 'Immobilier de luxe'],
  'Développement personnel': ['Productivité', 'Discipline', 'Confiance en soi', 'Habitudes', 'Études', 'Carrière', 'Psychologie', 'Motivation', 'Organisation'],
  Mode: ['Streetwear', 'Luxe', 'Mode homme', 'Mode femme', 'Vintage', 'Sneakers', 'Accessoires', 'Conseils vestimentaires', 'Couture', 'Mode éthique'],
  Beauté: ['Maquillage', 'Skincare', 'Coiffure', 'Parfums', 'Beauté naturelle'],
  Fitness: ['Musculation', 'Perte de poids', 'Nutrition', 'Course', 'CrossFit', 'Yoga', 'Coaching', 'Fitness maison'],
  Finance: ['Investissement', 'Bourse', 'Crypto', 'Finances personnelles', 'Fiscalité', 'Épargne', 'Trading'],
  'Business / Entrepreneuriat': ['Startup', 'Freelance', 'E-commerce', 'Vente', 'Management', 'Création entreprise'],
  Technologie: ['Intelligence artificielle', 'Smartphones', 'Hardware', 'Logiciels', 'Cybersécurité', 'Développement informatique'],
  Cuisine: ['Recettes', 'Pâtisserie', 'Cuisine saine', 'Cuisine du monde', 'Cuisine rapide'],
  Voyage: ['Vlog voyage', 'Van life', 'Expatriation', 'Bons plans', 'Voyage solo'],
  Automobile: ['Essais', 'Mécanique', 'Voitures électriques', 'Sport automobile', 'Moto'],
  Musique: ['Production musicale', 'Beatmaking', 'Instruments', 'Chant', 'Critiques musicales'],
  Éducation: ['Tutoriels', 'Langues', 'Sciences', 'Histoire', 'Orientation'],
  Divertissement: ['Humour', 'Cinéma et séries', 'Réactions', 'Culture web'],
  Sport: ['Football', 'Basket', 'Tennis', 'Cyclisme', 'Sports de combat'],
  Lifestyle: ['Vlog', 'Maison', 'Famille', 'Minimalisme', 'Routine'],
  'Photographie / Vidéo': ['Photographie', 'Montage vidéo', 'Caméras', 'Éclairage', 'Création de contenu'],
  Marketing: ['SEO', 'Publicité', 'Réseaux sociaux', 'Growth', 'Copywriting'],
  Podcast: ['Interviews', 'Actualité', 'Culture', 'Business', 'Société'],
  Autre: [],
} as const

export type SearchTarget = {
  niche: string
  subNiches: string[]
  customKeyword: string
  language: string
}

const SUBNICHE_ASSOCIATIONS: Record<string, string[]> = {
  fortnite: ['fortnite', 'gameplay fortnite', 'battle royale', 'chapitre fortnite'],
  'mode homme': ['mode homme', 'style masculin', 'conseils homme', 'tenue homme', 'look homme'],
  streetwear: ['streetwear', 'mode urbaine', 'sneakers', 'look streetwear'],
  minecraft: ['minecraft', 'survie minecraft', 'construction minecraft'],
  roblox: ['roblox', 'gameplay roblox'],
  'investissement locatif': ['investissement locatif', 'rentabilite locative', 'immobilier locatif'],
  musculation: ['musculation', 'entrainement musculation', 'prise de masse'],
}

export function normalizeTargetText(value: unknown): string {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function validateSearchTarget(input: unknown): SearchTarget | null {
  const value = input as Record<string, unknown>
  const niche = typeof value?.niche === 'string' ? value.niche.trim() : ''
  const language = typeof value?.lang === 'string' ? value.lang.trim() : ''
  const customKeyword = typeof value?.customKeyword === 'string' ? value.customKeyword.trim() : ''
  const allowedSubNiches = NICHE_CONFIG[niche as keyof typeof NICHE_CONFIG]
  const requested = Array.isArray(value?.subNiches) ? value.subNiches : []
  if (!allowedSubNiches || !SEARCH_LANGUAGES.includes(language as any) || customKeyword.length > 80 || requested.length > 5) return null
  const subNiches = requested.filter((item): item is string => typeof item === 'string' && (allowedSubNiches as readonly string[]).includes(item))
  if (subNiches.length !== requested.length || (niche === 'Autre' && !customKeyword)) return null
  return { niche, subNiches, customKeyword, language }
}

export function buildTargetQuery(target: SearchTarget): string {
  return [target.niche === 'Autre' ? '' : target.niche, ...target.subNiches, target.customKeyword].filter(Boolean).join(' ')
}

export function getSubnicheVocabulary(value: unknown): string[] {
  const normalized = normalizeTargetText(value)
  if (!normalized) return []
  return SUBNICHE_ASSOCIATIONS[normalized] || [normalized]
}

export function getNicheVocabulary(value: unknown): string[] {
  const normalized = normalizeTargetText(value)
  const configured = Object.entries(NICHE_CONFIG).find(([name]) => normalizeTargetText(name) === normalized)?.[1] || []
  return Array.from(new Set([normalized, ...configured.flatMap(getSubnicheVocabulary)]))
}

export function getPrimarySearchFocus(target: SearchTarget): string {
  return target.customKeyword || target.subNiches[0] || target.niche
}

export function getSearchFocusVariant(target: SearchTarget): string | null {
  const focus = getPrimarySearchFocus(target)
  const terms = getSubnicheVocabulary(focus)
  return terms.find(term => normalizeTargetText(term) !== normalizeTargetText(focus)) || null
}
