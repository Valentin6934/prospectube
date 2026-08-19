import { getNicheVocabulary, getSubnicheVocabulary, normalizeTargetText, type SearchTarget } from './searchTargeting'

export type RecentVideo = { title?: string; description?: string; publishedAt?: string; viewCount?: number; likeCount?: number; commentCount?: number; categoryId?: string; defaultLanguage?: string; durationSeconds?: number }
export type CreatorActivityStatus = 'ACTIVE_HIGH' | 'ACTIVE_MEDIUM' | 'ACTIVE_LOW' | 'INACTIVE' | 'LIMITED_DATA'

export const ACTIVE_CREATOR_STATUSES: CreatorActivityStatus[] = ['ACTIVE_HIGH', 'ACTIVE_MEDIUM', 'ACTIVE_LOW']

export function isCreatorActive(status?: CreatorActivityStatus | null): boolean {
  return Boolean(status && ACTIVE_CREATOR_STATUSES.includes(status))
}

export type CreatorActivity = {
  status: CreatorActivityStatus
  label: 'Très active' | 'Active' | 'Régulière' | 'Peu active' | 'Publication récente' | 'Inactive' | 'Données limitées'
  lastPublishedAt: string | null
  ageDays: number | null
  videosLast30Days: number
  videosLast90Days: number
  medianPublishIntervalDays: number | null
  sampleSize: number
  hasFrequencyData: boolean
}

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

export function analyzeCreatorActivity(videos: RecentVideo[], now = new Date()): CreatorActivity {
  const dates = videos.map(video => new Date(String(video.publishedAt || ''))).filter(date => !Number.isNaN(date.getTime())).sort((a, b) => b.getTime() - a.getTime())
  if (!dates.length) {
    return { status: 'LIMITED_DATA', label: 'Données limitées', lastPublishedAt: null, ageDays: null, videosLast30Days: 0, videosLast90Days: 0, medianPublishIntervalDays: null, sampleSize: 0, hasFrequencyData: false }
  }

  const ageInDays = (date: Date) => Math.max(0, (now.getTime() - date.getTime()) / 86400000)
  const ageDays = ageInDays(dates[0])
  const videosLast30Days = dates.filter(date => ageInDays(date) <= 30).length
  const videosLast90Days = dates.filter(date => ageInDays(date) <= 90).length
  const intervals = dates.slice(0, -1).map((date, index) => Math.abs(date.getTime() - dates[index + 1].getTime()) / 86400000)
  const medianPublishIntervalDays = intervals.length ? calculateMedian(intervals) : null
  const status: CreatorActivityStatus = ageDays <= 30
    ? 'ACTIVE_HIGH'
    : ageDays <= 60
      ? 'ACTIVE_MEDIUM'
      : ageDays <= 90
        ? 'ACTIVE_LOW'
        : 'INACTIVE'
  const hasFrequencyData = dates.length >= 2
  let label: CreatorActivity['label'] = 'Données limitées'

  if (status === 'INACTIVE') label = 'Inactive'
  else if (!hasFrequencyData) label = 'Publication récente'
  else if (hasFrequencyData && (videosLast30Days >= 4 || Number(medianPublishIntervalDays) <= 8)) label = 'Très active'
  else if (hasFrequencyData && (videosLast90Days >= 6 || Number(medianPublishIntervalDays) <= 16)) label = 'Active'
  else if (hasFrequencyData && (videosLast90Days >= 3 || Number(medianPublishIntervalDays) <= 35)) label = 'Régulière'
  else if (hasFrequencyData) label = 'Peu active'

  return {
    status,
    label,
    lastPublishedAt: dates[0].toISOString(),
    ageDays,
    videosLast30Days,
    videosLast90Days,
    medianPublishIntervalDays,
    sampleSize: dates.length,
    hasFrequencyData,
  }
}

export function classifyPublishingFrequency(videos: RecentVideo[], now = new Date()): string {
  return analyzeCreatorActivity(videos, now).label
}

export function getContactability(channel: any) {
  const channels = [channel.email, channel.website, channel.instagram, channel.tiktok, channel.facebook, channel.twitter, channel.twitch].filter(Boolean).length
  return { level: channel.email && channels >= 2 ? 'Élevée' : channels >= 1 ? 'Moyenne' : 'Faible', channels }
}

export function calculateProspectScore(input: { videos: RecentVideo[]; target: SearchTarget; subscribers: number }) {
  const relevance = scoreChannelContentRelevance(input.videos, input.target)
  const language = detectDominantContentLanguage(input.videos)
  const activity = analyzeCreatorActivity(input.videos)
  const frequency = activity.label
  const ageDays = activity.ageDays ?? Infinity
  const medianViews = calculateMedian(input.videos.map(video => Number(video.viewCount || 0)))
  const ratio = calculateRecentViewSubscriberRatio(input.videos, input.subscribers)
  const engagementRate = calculateRecentEngagementRate(input.videos)
  const editingPotential = calculateEditingPotential(input.videos, medianViews)

  const recentViews = medianViews >= 100000 ? 30 : medianViews >= 50000 ? 27 : medianViews >= 20000 ? 24 : medianViews >= 10000 ? 21 : medianViews >= 5000 ? 16 : medianViews >= 2000 ? 10 : medianViews > 0 ? 4 : 0
  const growthPotential = ratio >= 1 ? 20 : ratio >= 0.6 ? 18 : ratio >= 0.35 ? 15 : ratio >= 0.2 ? 11 : ratio >= 0.1 ? 7 : ratio > 0 ? 3 : 0
  const publishingRhythm = frequency === 'Très active' ? 15 : frequency === 'Active' ? 12 : frequency === 'Régulière' ? 8 : frequency === 'Peu active' ? 3 : 0
  const recentActivity = ageDays <= 14 ? 15 : ageDays <= 30 ? 13 : ageDays <= 60 ? 9 : ageDays <= 90 ? 5 : Number.isFinite(ageDays) ? 1 : 0
  const targeting = Math.min(5, Math.round(relevance.score * 0.05))
  const scoreBreakdown = { recentViews, growthPotential, publishingRhythm, recentActivity, editingNeed: editingPotential.points, targeting }
  const rawScore = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0)
  const score = activity.status === 'INACTIVE' ? Math.min(45, rawScore) : rawScore
  const label = score >= 80 ? 'Excellent prospect' : score >= 65 ? 'Bon prospect' : score >= 50 ? 'Prospect moyen' : 'Données limitées'
  const confidence = input.videos.length >= 8 ? 'Elevee' : input.videos.length >= 3 ? 'Moyenne' : 'Faible'
  return { score, label, scoreBreakdown, relevance, language, frequency, activity, medianViews, recentViewSubscriberRatio: ratio, engagementRate, editingPotential, confidence, lastPublishedAt: activity.lastPublishedAt }
}
