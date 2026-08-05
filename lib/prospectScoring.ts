import { getNicheVocabulary, getSubnicheVocabulary, normalizeTargetText, type SearchTarget } from './searchTargeting'

export type RecentVideo = { title?: string; description?: string; publishedAt?: string; viewCount?: number; likeCount?: number; commentCount?: number; categoryId?: string; defaultLanguage?: string; durationSeconds?: number }

const STOP_WORDS: Record<string, string[]> = {
  fr: [' le ', ' la ', ' les ', ' des ', ' une ', ' avec ', ' pour ', ' dans ', ' sur ', ' est ', ' vous '],
  en: [' the ', ' and ', ' with ', ' for ', ' this ', ' from ', ' your ', ' is '],
  es: [' el ', ' los ', ' una ', ' con ', ' para ', ' que ', ' del '],
  pt: [' de ', ' com ', ' para ', ' uma ', ' que ', ' voce ', ' nao '],
  de: [' der ', ' die ', ' das ', ' und ', ' mit ', ' für ', ' ist '],
  it: [' il ', ' la ', ' con ', ' per ', ' una ', ' che ', ' del '],
}

export function calculateMedian(values: number[]): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function calculateTrimmedMean(values: number[], trimRatio = 0.1): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return 0
  const trim = sorted.length >= 5 ? Math.floor(sorted.length * Math.max(0, Math.min(0.4, trimRatio))) : 0
  const kept = sorted.slice(trim, sorted.length - trim || undefined)
  return kept.reduce((sum, value) => sum + value, 0) / kept.length
}

export function buildTopicVocabulary(target: SearchTarget): string[] {
  return Array.from(new Set([...getNicheVocabulary(target.niche), target.customKeyword]
    .flatMap(value => normalizeTargetText(value).split(' ')).filter(value => value.length >= 3)))
}

export function buildSubnicheVocabulary(target: SearchTarget): string[] {
  return Array.from(new Set([...target.subNiches, target.customKeyword]
    .flatMap(getSubnicheVocabulary)
    .flatMap(value => [normalizeTargetText(value), ...normalizeTargetText(value).split(' ')])
    .filter(value => value.length >= 3)))
}

export function scoreVideoTopicMatch(video: RecentVideo, vocabulary: string[]): number {
  if (!vocabulary.length) return 0
  const title = normalizeTargetText(video.title)
  const description = normalizeTargetText(video.description)
  const hits = vocabulary.filter(word => title.includes(word) || description.includes(word)).length
  return Math.min(100, Math.round((hits / Math.min(4, vocabulary.length)) * 100))
}

export function detectDominantContentLanguage(videos: RecentVideo[]) {
  const scores = Object.fromEntries(Object.keys(STOP_WORDS).map(code => [code, 0])) as Record<string, number>
  for (const video of videos) {
    const declared = String(video.defaultLanguage || '').slice(0, 2).toLowerCase()
    if (declared in scores) scores[declared] += 5
    const tokens = new Set(normalizeTargetText(`${video.title || ''} ${video.description || ''}`).split(' ').filter(Boolean))
    for (const [code, words] of Object.entries(STOP_WORDS)) scores[code] += words.filter(word => tokens.has(word.trim())).length
  }
  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [language, score] = ordered[0]
  const confidence = score >= 8 ? 'Élevée' : score >= 3 ? 'Moyenne' : 'Faible'
  return { language: score > 0 ? language : null, confidence }
}

export function scoreChannelContentRelevance(videos: RecentVideo[], target: SearchTarget) {
  const vocabulary = buildTopicVocabulary(target)
  const matches = videos.map(video => scoreVideoTopicMatch(video, vocabulary))
  const relevantCount = matches.filter(score => score >= 25).length
  const score = videos.length ? Math.round((relevantCount / videos.length) * 75 + calculateMedian(matches) * 0.25) : 0
  const subVocabulary = buildSubnicheVocabulary(target)
  const subMatches = videos.map(video => scoreVideoTopicMatch(video, subVocabulary))
  const subnicheScore = subVocabulary.length && videos.length ? Math.round(calculateMedian(subMatches)) : 100
  const subnicheLabel = subnicheScore >= 60 ? 'Forte' : subnicheScore >= 25 ? 'Moyenne' : subnicheScore > 0 ? 'Faible' : 'Non confirmee'
  return { score: Math.min(100, score), relevantCount, sampleSize: videos.length, subnicheScore, subnicheLabel }
}

export function calculateEditingPotential(videos: RecentVideo[], medianViews: number) {
  const longForm = videos.filter(video => Number(video.durationSeconds || 0) >= 480).length
  const editingSignals = videos.filter(video => /gameplay|best of|vlog|interview|podcast|tutoriel|test|review|reaction|documentaire/i.test(`${video.title || ''} ${video.description || ''}`)).length
  const sampleSize = Math.max(1, videos.length)
  const longFormPoints = longForm >= 3 || longForm / sampleSize >= 0.5 ? 7 : longForm > 0 ? 4 : 0
  const editingSignalPoints = editingSignals >= 3 || editingSignals / sampleSize >= 0.5 ? 5 : editingSignals > 0 ? 3 : 0
  const viableAudiencePoints = medianViews >= 10000 ? 3 : medianViews >= 3000 ? 2 : medianViews > 0 ? 1 : 0
  const points = Math.min(15, longFormPoints + editingSignalPoints + viableAudiencePoints)
  const value = Math.round((points / 15) * 100)
  return { points, value, label: value >= 75 ? 'Eleve' : value >= 45 ? 'Moyen' : 'Faible', longFormCount: longForm }
}

export function calculateRecentViewSubscriberRatio(videos: RecentVideo[], subscribers: number): number {
  return subscribers > 0 ? calculateMedian(videos.map(video => Number(video.viewCount || 0))) / subscribers : 0
}

export function calculateRecentEngagementRate(videos: RecentVideo[]): number | null {
  const rates = videos.filter(video => Number(video.viewCount) > 0 && (video.likeCount !== undefined || video.commentCount !== undefined))
    .map(video => ((Number(video.likeCount || 0) + Number(video.commentCount || 0)) / Number(video.viewCount)) * 100)
  return rates.length ? calculateMedian(rates) : null
}

export function classifyPublishingFrequency(videos: RecentVideo[], now = new Date()): string {
  const dates = videos.map(video => new Date(String(video.publishedAt || ''))).filter(date => !Number.isNaN(date.getTime())).sort((a, b) => b.getTime() - a.getTime())
  if (dates.length < 2) return dates.length ? 'Données limitées' : 'Inconnue'
  const weeks = Math.max(1, (now.getTime() - dates[dates.length - 1].getTime()) / 604800000)
  const perWeek = dates.length / weeks
  return perWeek >= 2 ? 'Très active' : perWeek >= 0.75 ? 'Active' : perWeek >= 0.25 ? 'Occasionnelle' : 'Peu active'
}

export function getContactability(channel: any) {
  const channels = [channel.email, channel.website, channel.instagram, channel.tiktok, channel.twitch].filter(Boolean).length
  return { level: channel.email && channels >= 2 ? 'Élevée' : channels >= 1 ? 'Moyenne' : 'Faible', channels }
}

export function calculateProspectScore(input: { videos: RecentVideo[]; target: SearchTarget; subscribers: number }) {
  const relevance = scoreChannelContentRelevance(input.videos, input.target)
  const language = detectDominantContentLanguage(input.videos)
  const frequency = classifyPublishingFrequency(input.videos)
  const latest = Math.max(0, ...input.videos.map(video => new Date(String(video.publishedAt || '')).getTime()).filter(Number.isFinite))
  const ageDays = latest ? (Date.now() - latest) / 86400000 : Infinity
  const medianViews = calculateMedian(input.videos.map(video => Number(video.viewCount || 0)))
  const ratio = calculateRecentViewSubscriberRatio(input.videos, input.subscribers)
  const engagementRate = calculateRecentEngagementRate(input.videos)
  const editingPotential = calculateEditingPotential(input.videos, medianViews)

  const recentViews = medianViews >= 100000 ? 30 : medianViews >= 50000 ? 27 : medianViews >= 20000 ? 24 : medianViews >= 10000 ? 21 : medianViews >= 5000 ? 16 : medianViews >= 2000 ? 10 : medianViews > 0 ? 4 : 0
  const growthPotential = ratio >= 1 ? 20 : ratio >= 0.6 ? 18 : ratio >= 0.35 ? 15 : ratio >= 0.2 ? 11 : ratio >= 0.1 ? 7 : ratio > 0 ? 3 : 0
  const publishingRhythm = frequency === 'Très active' ? 15 : frequency === 'Active' ? 12 : frequency === 'Occasionnelle' ? 7 : frequency === 'Peu active' ? 2 : 0
  const recentActivity = ageDays <= 14 ? 15 : ageDays <= 30 ? 13 : ageDays <= 60 ? 9 : ageDays <= 90 ? 5 : Number.isFinite(ageDays) ? 1 : 0
  const targeting = Math.min(5, Math.round(relevance.score * 0.05))
  const scoreBreakdown = { recentViews, growthPotential, publishingRhythm, recentActivity, editingNeed: editingPotential.points, targeting }
  const score = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0)
  const label = score >= 80 ? 'Excellent prospect' : score >= 65 ? 'Bon prospect' : score >= 50 ? 'Prospect moyen' : 'Données limitées'
  const confidence = input.videos.length >= 8 ? 'Elevee' : input.videos.length >= 3 ? 'Moyenne' : 'Faible'
  return { score, label, scoreBreakdown, relevance, language, frequency, medianViews, recentViewSubscriberRatio: ratio, engagementRate, editingPotential, confidence, lastPublishedAt: latest ? new Date(latest).toISOString() : null }
}
