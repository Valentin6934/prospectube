const assert = require('node:assert/strict')
const test = require('node:test')
const ts = require('typescript')
const fs = require('node:fs')

require.extensions['.ts'] = function transpile(module, filename) {
  const source = require('node:fs').readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  module._compile(output, filename)
}

const { selectDiverseProspectPreview } = require('../lib/freePreview.ts')
const { getPlanName, isFree, isPro, requireProResponse } = require('../lib/plan.ts')
const {
  getCampaignProspectSkipReason,
  getCampaignDraftCreationPlan,
  getCampaignProspectWithDraft,
  getCampaignGmailActionLabel,
  getCampaignGmailProgressLabel,
  getCampaignGmailSingleActionLabel,
  getCampaignManualSendPlan,
  getCampaignSendSummary,
  hasCampaignDraftChanges,
  isCampaignProspectSendEligible,
  limitUniqueCampaignSelection,
  normalizeCampaignMessage,
} = require('../lib/campaignWorkflow.ts')
const { CAMPAIGN_AI_ENABLED } = require('../lib/campaignFeatures.ts')
const {
  getProspectImageUrl,
  getProspectInitials,
  normalizeProspectPresentation,
} = require('../lib/prospectPresentation.ts')
const {
  buildCampaignDetailUrl,
  buildCampaignProspectPayload,
  getCampaignFromApiResponse,
  getCampaignIdFromCreateResponse,
} = require('../lib/campaignClient.ts')
const {
  buildCampaignAiPrompt,
  getCampaignAiConfigError,
  parseCampaignAiText,
} = require('../lib/campaignMessaging.ts')
const { encodeGmailMessage } = require('../lib/gmailMessage.ts')
const {
  buildDisconnectedGmailStatus,
  buildGmailStatus,
  getSafeGmailErrorMessage,
  REQUIRED_GMAIL_DRAFT_SCOPE,
  shouldDisableGmailDrafts,
  isGmailIntegrationAllowed,
} = require('../lib/gmailStatus.ts')
const {
  classifyGoogleOAuthError,
  getSafeGmailOAuthMessage,
  isConnectedOAuthReplay,
  logSafeGmailOAuthFailure,
} = require('../lib/gmailOAuthErrors.ts')
const {
  extractPublicEmails,
  normalizeObfuscatedEmail,
  rankPublicEmailCandidates,
  redactEmailForLogs,
  selectBestPublicEmail,
} = require('../lib/publicContactExtraction.ts')
const { PRODUCT_LIMITS, PRO_MONTHLY_PRICE_LABEL } = require('../lib/product.ts')
const {
  buildGmailOAuthStatusRedirect,
  createGmailOAuthState,
  getRequestOriginFromParts,
  getSafeGmailOAuthReturnPath,
  getStableGmailOAuthCallbackUrl,
  isAllowedProspectTubeReturnOrigin,
  verifyGmailOAuthState,
} = require('../lib/gmailOAuthUrl.ts')
const {
  STRIPE_CLIENT_ERROR_MESSAGE,
  StripeConfigError,
  getSafeStripeConfigLog,
  getValidatedStripeConfig,
  toStripeConfigError,
  validateStripePriceForPro,
  validateStripePriceId,
} = require('../lib/stripeConfig.ts')
const {
  YOUTUBE_DAILY_QUOTA_MESSAGE,
  YOUTUBE_CONFIGURATION_MESSAGE,
  YOUTUBE_INVALID_SEARCH_PARAMETERS_MESSAGE,
  buildYouTubeErrorResponse,
  classifyYouTubeError,
  getSafeYouTubeLog,
  sanitizeGoogleMessage,
} = require('../lib/youtubeQuota.ts')
const {
  MAX_YOUTUBE_SEARCH_QUERIES,
  MAX_SEARCH_LIST_CALLS,
  analyzeYouTubeChannelRange,
  buildYouTubeQueryVariants,
  buildYouTubeSearchParams,
  collectNewYouTubeChannelIds,
  getSafeYouTubeSearchParamsLog,
  normalizeYouTubeLanguage,
  shouldRunNextYouTubeQuery,
} = require('../lib/youtubeSearchParams.ts')
const {
  FREE_LIFETIME_SEARCH_LIMIT,
  FREE_SEARCH_PERIOD_KEY,
  FREE_SEARCH_QUOTA_VERSION,
  PRO_DAILY_SEARCH_LIMIT,
  SEARCH_CACHE_VERSION,
  SEARCH_CACHE_TTL_HOURS,
  SEARCH_CATALOG_POOR_REFRESH_HOURS,
  SEARCH_NEGATIVE_CACHE_TTL_HOURS,
  buildSearchCacheKey,
  getCatalogAgeHours,
  getSearchQuotaMessage,
  getUtcDayKey,
  normalizeSearchText,
  shouldEnrichSearchCatalog,
} = require('../lib/searchPolicy.ts')
const { filterYouTubeCatalog, mergeCatalogChannels } = require('../lib/youtubeCatalog.ts')
const { getReleasedSearchQuotaSnapshot, getSearchQuotaSnapshot, releaseSearchQuota, reserveSearchQuota } = require('../lib/searchQuota.ts')
const { FREE_LIFETIME_CAMPAIGN_LIMIT, FREE_CAMPAIGN_PROSPECT_LIMIT, FREE_CAMPAIGN_MARKER_PERIOD, FREE_CAMPAIGN_COMPLETED_PERIOD } = require('../lib/campaignAccess.ts')
const { NICHE_CONFIG, validateSearchTarget, buildTargetQuery, getSubnicheVocabulary, getPrimarySearchFocus, getSearchFocusVariant, getSearchFocusVariants } = require('../lib/searchTargeting.ts')
const { buildExposureTargetKey, buildUserTargetKey, countGlobalChannelExposure, diversifyProspects, extractChannelIdsFromSearchResults, getUserTargetExposure, markSearchResultsForTarget, sortProspectsByQuality, sortProspectsForRotation } = require('../lib/resultDiversification.ts')
const { buildDiscoveryFallbackQueries, calculateQueryVariantYield, classifyQueryBreadth, rankQueryVariants, selectComplementaryVariant, selectNextDiscoveryVariant, updateVariantPerformance } = require('../lib/discoveryVariants.ts')
const { calculateCatalogCoverage, getUserCoverage } = require('../lib/catalogCoverage.ts')
const { classifyRegistrationError, getSafePrismaMeta, normalizeAccountEmail, validateRegistrationInput } = require('../lib/registration.ts')
const { calculateMedian, calculateTrimmedMean, scoreVideoTopicMatch, scoreChannelContentRelevance, detectDominantContentLanguage, calculateProspectScore, getContactability } = require('../lib/prospectScoring.ts')
const {
  PROSPECT_SCORE_EXPLANATION,
  PROSPECT_SCORE_LEVELS,
  PROSPECT_SCORE_SIGNALS,
  PROSPECT_SCORE_THRESHOLDS,
  PROSPECT_SCORE_TRANSPARENCY_NOTE,
} = require('../lib/prospectScoreInfo.ts')

test('selects high, median and low scored prospects deterministically', () => {
  const prospects = [
    { id: 'a', score: 98 },
    { id: 'b', score: 86 },
    { id: 'c', score: 72 },
    { id: 'd', score: 55 },
    { id: 'e', score: 21 },
  ]

  assert.deepEqual(
    selectDiverseProspectPreview(prospects).map(item => item.id),
    ['a', 'c', 'e']
  )
})

test('fills with best available prospects without duplicates', () => {
  const prospects = [
    { id: 'a', score: 91 },
    { id: 'b', score: 80 },
  ]

  assert.deepEqual(
    selectDiverseProspectPreview(prospects).map(item => item.id),
    ['a', 'b']
  )
})

test('does not duplicate a prospect when median overlaps an existing pick', () => {
  const prospects = [
    { id: 'a', score: 90 },
    { id: 'b', score: 40 },
    { id: 'c', score: 10 },
  ]

  const preview = selectDiverseProspectPreview(prospects)

  assert.deepEqual(preview.map(item => item.id), ['a', 'b', 'c'])
  assert.equal(new Set(preview.map(item => item.id)).size, preview.length)
})

test('falls back to the best available real prospects when scores are close', () => {
  const prospects = [
    { id: 'a', score: 72 },
    { id: 'b', score: 71 },
    { id: 'c', score: 70 },
    { id: 'd', score: 69 },
  ]

  assert.deepEqual(
    selectDiverseProspectPreview(prospects).map(item => item.id),
    ['a', 'b', 'd']
  )
})

test('returns an empty preview for an empty input or invalid limit', () => {
  assert.deepEqual(selectDiverseProspectPreview([]), [])
  assert.deepEqual(selectDiverseProspectPreview([{ id: 'a', score: 50 }], 0), [])
})

test('is deterministic across repeated calls', () => {
  const prospects = [
    { channelId: 'c1', score: 33 },
    { channelId: 'c2', score: 99 },
    { channelId: 'c3', score: 64 },
    { channelId: 'c4', score: 12 },
    { channelId: 'c5', score: 75 },
  ]

  const first = selectDiverseProspectPreview(prospects).map(item => item.channelId)
  const second = selectDiverseProspectPreview(prospects).map(item => item.channelId)

  assert.deepEqual(first, second)
})

test('plan helpers reject free users and allow pro variants', () => {
  const proValues = ['Pro', 'PRO', 'pro', ' Pro ']
  const freeValues = ['Gratuit', 'FREE', '', '   ', null, undefined, 'Enterprise']

  for (const value of proValues) {
    assert.equal(isPro(value), true)
    assert.equal(isFree(value), false)
  }

  for (const value of freeValues) {
    assert.equal(isPro(value), false)
    assert.equal(isFree(value), true)
  }
})

test('getPlanName returns the canonical session value', () => {
  assert.equal(getPlanName('Pro'), 'Pro')
  assert.equal(getPlanName('PRO'), 'Pro')
  assert.equal(getPlanName('pro'), 'Pro')
  assert.equal(getPlanName(' Pro '), 'Pro')
  assert.equal(getPlanName('Gratuit'), 'Gratuit')
  assert.equal(getPlanName('FREE'), 'Gratuit')
  assert.equal(getPlanName(''), 'Gratuit')
  assert.equal(getPlanName(null), 'Gratuit')
  assert.equal(getPlanName(undefined), 'Gratuit')
  assert.equal(getPlanName('Enterprise'), 'Gratuit')
})

test('requireProResponse stays aligned with isPro free denial', async () => {
  assert.equal(isPro('Gratuit'), false)

  const response = requireProResponse()
  const body = await response.json()

  assert.equal(response.status, 403)
  assert.equal(body.error, 'PRO_REQUIRED')
  assert.equal(body.upgrade, true)
})

test('campaign send eligibility requires email, subject, body and unsent status', () => {
  assert.equal(isCampaignProspectSendEligible({
    email: 'creator@example.com',
    generatedSubject: 'Collaboration',
    generatedBody: 'Bonjour',
    sendStatus: 'Non envoyé',
  }), true)

  assert.equal(isCampaignProspectSendEligible({
    email: null,
    generatedSubject: 'Collaboration',
    generatedBody: 'Bonjour',
    sendStatus: 'Non envoyé',
  }), false)

  assert.equal(isCampaignProspectSendEligible({
    email: 'creator@example.com',
    generatedSubject: '',
    generatedBody: 'Bonjour',
    sendStatus: 'Non envoyé',
  }), false)

  assert.equal(isCampaignProspectSendEligible({
    email: 'creator@example.com',
    generatedSubject: 'Collaboration',
    generatedBody: '   ',
    sendStatus: 'Non envoyé',
  }), false)

  assert.equal(isCampaignProspectSendEligible({
    email: 'creator@example.com',
    generatedSubject: 'Collaboration',
    generatedBody: 'Bonjour',
    sendStatus: 'Envoyé',
  }), false)

  assert.equal(isCampaignProspectSendEligible({
    email: 'creator@example.com',
    generatedSubject: 'Collaboration',
    generatedBody: 'Bonjour',
    sendStatus: 'Non envoye',
    gmailMessageId: 'gmail_draft_123',
  }), false)
})

test('campaign manual message drafts are trimmed before persistence and send eligibility', () => {
  const normalized = normalizeCampaignMessage({
    subject: '  Collaboration ProspectTube  ',
    body: '\nBonjour Thomas\n',
  })

  assert.deepEqual(normalized, {
    subject: 'Collaboration ProspectTube',
    body: 'Bonjour Thomas',
  })
  assert.equal(isCampaignProspectSendEligible({
    email: 'creator@example.com',
    generatedSubject: normalized.subject,
    generatedBody: normalized.body,
    sendStatus: 'Non envoye',
  }), true)
})

test('campaign send eligibility uses the current manual draft instead of stale persisted message fields', () => {
  const persistedProspect = {
    email: 'creator@example.com',
    generatedSubject: '',
    generatedBody: '',
    sendStatus: 'Non envoye',
  }

  assert.equal(isCampaignProspectSendEligible(persistedProspect), false)

  const prospectWithDraft = getCampaignProspectWithDraft(persistedProspect, {
    subject: '  Collaboration  ',
    body: '  Bonjour, je vous contacte pour une campagne.  ',
  })

  assert.equal(prospectWithDraft.generatedSubject, 'Collaboration')
  assert.equal(prospectWithDraft.generatedBody, 'Bonjour, je vous contacte pour une campagne.')
  assert.equal(isCampaignProspectSendEligible(prospectWithDraft), true)
})

test('campaign manual autosave targets only selected prospects with changed drafts', () => {
  const persistedProspect = {
    email: 'creator@example.com',
    generatedSubject: 'Collaboration',
    generatedBody: 'Bonjour',
    sendStatus: 'Non envoye',
  }

  assert.equal(hasCampaignDraftChanges(persistedProspect, {
    subject: ' Collaboration ',
    body: ' Bonjour ',
  }), false)

  assert.equal(hasCampaignDraftChanges(persistedProspect, {
    subject: 'Nouveau sujet',
    body: 'Bonjour',
  }), true)
})

test('campaign manual send plan waits for changed selected drafts before Gmail and excludes invalid prospects', () => {
  const prospects = [
    {
      id: 'p1',
      email: 'one@example.com',
      generatedSubject: '',
      generatedBody: '',
      sendStatus: 'Non envoye',
    },
    {
      id: 'p2',
      email: 'two@example.com',
      generatedSubject: 'Sujet existant',
      generatedBody: 'Message existant',
      sendStatus: 'Non envoye',
    },
    {
      id: 'p3',
      email: null,
      generatedSubject: '',
      generatedBody: '',
      sendStatus: 'Non envoye',
    },
  ]

  const plan = getCampaignManualSendPlan(prospects, {
    p1: { subject: ' Nouveau sujet ', body: ' Nouveau message ' },
    p2: { subject: ' Sujet existant ', body: ' Message existant ' },
    p3: { subject: 'Sujet', body: 'Message' },
  }, ['p1', 'p2', 'p3'])

  assert.deepEqual(plan.prospectsWithDrafts.map(prospect => prospect.generatedSubject), [
    'Nouveau sujet',
    'Sujet existant',
    'Sujet',
  ])
  assert.deepEqual(plan.eligibleProspects.map(prospect => prospect.id), ['p1', 'p2'])
  assert.deepEqual(plan.prospectsToSave.map(prospect => prospect.id), ['p1'])
})

test('campaign draft CTA counts only selected prospects that are ready for Gmail drafts', () => {
  const prospects = [
    { id: 'ready', email: 'ready@example.com', generatedSubject: 'Sujet', generatedBody: 'Message', sendStatus: 'Non envoye' },
    { id: 'no_email', email: null, generatedSubject: 'Sujet', generatedBody: 'Message', sendStatus: 'Non envoye' },
    { id: 'no_subject', email: 'subject@example.com', generatedSubject: '', generatedBody: 'Message', sendStatus: 'Non envoye' },
    { id: 'no_body', email: 'body@example.com', generatedSubject: 'Sujet', generatedBody: '   ', sendStatus: 'Non envoye' },
    { id: 'processed', email: 'done@example.com', generatedSubject: 'Sujet', generatedBody: 'Message', sendStatus: 'Non envoye', gmailMessageId: 'gmail_draft_123' },
    { id: 'unselected_ready', email: 'other@example.com', generatedSubject: 'Sujet', generatedBody: 'Message', sendStatus: 'Non envoye' },
  ]

  const plan = getCampaignDraftCreationPlan(prospects, {}, [
    'ready',
    'no_email',
    'no_subject',
    'no_body',
    'processed',
    'missing',
  ])

  assert.equal(plan.selectedProspects.length, 5)
  assert.equal(plan.readyCount, 1)
  assert.deepEqual(plan.readyIds, ['ready'])
})

test('campaign manual message eligibility reports the exact missing field', () => {
  assert.equal(getCampaignProspectSkipReason({
    email: 'creator@example.com',
    generatedSubject: '   ',
    generatedBody: 'Bonjour',
    sendStatus: 'Non envoye',
  }), 'no_subject')

  assert.equal(getCampaignProspectSkipReason({
    email: 'creator@example.com',
    generatedSubject: 'Collaboration',
    generatedBody: '   ',
    sendStatus: 'Non envoye',
  }), 'no_body')

  assert.equal(getCampaignProspectSkipReason({
    email: 'creator@example.com',
    generatedSubject: 'Collaboration',
    generatedBody: 'Bonjour',
    sendStatus: 'Non envoye',
    gmailMessageId: 'gmail_draft_123',
  }), 'already_processed')
})

test('campaign send summary counts successes, failures and skipped prospects', () => {
  const summary = getCampaignSendSummary([
    { success: true },
    { success: false },
    { success: false, skippedReason: 'no_email' },
    { success: false, skippedReason: 'no_subject' },
    { success: false, skippedReason: 'no_body' },
  ])

  assert.equal(summary.successCount, 1)
  assert.equal(summary.failureCount, 1)
  assert.equal(summary.skippedNoEmailCount, 1)
  assert.equal(summary.skippedNoSubjectCount, 1)
  assert.equal(summary.skippedNoBodyCount, 1)
  assert.equal(summary.errorCount, 4)
  assert.equal(summary.campaignResultStatus, 'Partiellement envoyee')
})

test('campaign send summary exposes final status labels', () => {
  assert.equal(getCampaignSendSummary([{ success: true }]).campaignResultStatus, 'Envoyee')
  assert.equal(getCampaignSendSummary([{ success: true }, { success: false }]).campaignResultStatus, 'Partiellement envoyee')
  assert.equal(getCampaignSendSummary([{ success: false, skippedReason: 'no_email' }]).campaignResultStatus, 'Aucun email envoye')
})

test('campaign selection is deduplicated and limited to 20 prospects', () => {
  const ids = ['a', 'b', 'a', ...Array.from({ length: 25 }, (_, index) => `p${index}`)]
  const limited = limitUniqueCampaignSelection(ids)

  assert.equal(limited.length, 20)
  assert.equal(new Set(limited).size, limited.length)
  assert.deepEqual(limited.slice(0, 3), ['a', 'b', 'p0'])
})

test('campaign creation response exposes the real campaign id for immediate assignment', () => {
  assert.equal(getCampaignIdFromCreateResponse({ campaign: { id: 'campaign_123' } }), 'campaign_123')
  assert.equal(getCampaignIdFromCreateResponse({ campaign: { id: '' } }), null)
  assert.equal(getCampaignIdFromCreateResponse({ error: 'not found' }), null)
})

test('campaign prospect payload normalizes channel ids for existing and new campaigns', () => {
  assert.deepEqual(buildCampaignProspectPayload({ id: 'yt_1', name: 'Creator' }), {
    id: 'yt_1',
    channelId: 'yt_1',
    name: 'Creator',
  })

  assert.deepEqual(buildCampaignProspectPayload({ channelId: 'yt_2', id: 'ignored' }), {
    channelId: 'yt_2',
    id: 'ignored',
  })
})

test('campaign detail url and api parsing are stable', () => {
  assert.equal(buildCampaignDetailUrl('campaign 123'), '/campaigns?campaignId=campaign%20123')
  assert.deepEqual(getCampaignFromApiResponse({ campaign: { id: 'campaign_123' } }), { id: 'campaign_123' })
  assert.equal(getCampaignFromApiResponse({ error: 'Campagne introuvable' }), null)
})

test('campaign AI prompt includes prospect context without exposing configuration', () => {
  const prompt = buildCampaignAiPrompt({
    name: 'Creator Pro',
    email: 'creator@example.com',
    instagram: 'https://instagram.com/creator',
    tiktok: null,
    twitch: null,
    website: null,
    channelUrl: 'https://youtube.com/@creator',
    score: 84,
    scoreLabel: 'Excellent prospect',
    scoreReason: 'Email professionnel trouvé',
  })

  assert.match(prompt, /Creator Pro/)
  assert.match(prompt, /creator@example\.com/)
  assert.match(prompt, /84\/100/)
  assert.doesNotMatch(prompt, /ANTHROPIC_API_KEY|OPENAI_API_KEY/)
})

test('campaign AI response parsing handles subject, body and empty responses', () => {
  assert.deepEqual(parseCampaignAiText('Objet: Collaboration video\n\nBonjour Thomas', 'Creator'), {
    subject: 'Collaboration video',
    body: 'Bonjour Thomas',
  })

  assert.deepEqual(parseCampaignAiText('Bonjour Thomas', 'Creator'), {
    subject: 'Collaboration avec Creator',
    body: 'Bonjour Thomas',
  })

  assert.throws(() => parseCampaignAiText('   ', 'Creator'), /vide/)
})

test('campaign AI configuration error hides broken generation states', () => {
  assert.equal(getCampaignAiConfigError('secret'), null)
  assert.equal(getCampaignAiConfigError(''), 'La generation IA est temporairement indisponible.')
  assert.equal(getCampaignAiConfigError(undefined), 'La generation IA est temporairement indisponible.')
})

test('campaign AI is hidden in the V1 campaign interface without deleting server helpers', () => {
  assert.equal(CAMPAIGN_AI_ENABLED, false)
})

test('campaign Gmail labels reflect draft mode instead of implying a real send', () => {
  assert.equal(getCampaignGmailActionLabel('draft', 12), 'Créer les brouillons (12)')
  assert.equal(getCampaignGmailSingleActionLabel('draft'), 'Créer le brouillon')
  assert.equal(getCampaignGmailProgressLabel('draft'), 'Création...')
  assert.equal(getCampaignGmailActionLabel('send', 21), 'Envoyer (20)')
  assert.equal(getCampaignGmailSingleActionLabel('send'), 'Envoyer')
  assert.equal(getCampaignGmailProgressLabel('send'), 'Envoi...')
})


test('gmail status exposes connected accounts without leaking tokens', () => {
  const status = buildGmailStatus({
    email: 'creator@gmail.com',
    accessToken: 'access-token-should-not-leak',
    refreshToken: 'refresh-token-should-not-leak',
    scope: REQUIRED_GMAIL_DRAFT_SCOPE,
    expiryDate: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }, 'draft')

  assert.equal(status.connected, true)
  assert.equal(status.status, 'connected')
  assert.equal(status.state, 'connected')
  assert.equal(status.canUseGmail, true)
  assert.equal(status.email, 'creator@gmail.com')
  assert.equal(status.hasRefreshToken, true)
  assert.equal(shouldDisableGmailDrafts(status), false)
  assert.equal(Object.prototype.hasOwnProperty.call(status, 'accessToken'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(status, 'refreshToken'), false)
})

test('gmail status distinguishes disconnected and expired connections', () => {
  const disconnected = buildDisconnectedGmailStatus('draft')
  assert.equal(disconnected.connected, false)
  assert.equal(disconnected.status, 'disconnected')
  assert.equal(disconnected.state, 'disconnected')
  assert.equal(disconnected.canUseGmail, false)
  assert.equal(shouldDisableGmailDrafts(disconnected), true)

  const expired = buildGmailStatus({
    email: 'creator@gmail.com',
    refreshToken: null,
    expiryDate: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }, 'draft')

  assert.equal(expired.connected, false)
  assert.equal(expired.status, 'expired')
  assert.equal(expired.state, 'expired')
  assert.equal(expired.canUseGmail, false)
  assert.equal(expired.reconnectRequired, true)
  assert.match(expired.message, /connexion Gmail a expir/)
  assert.equal(shouldDisableGmailDrafts(expired), true)
})

test('gmail user-facing errors stay safe for refresh token failures', () => {
  assert.match(getSafeGmailErrorMessage('invalid_refresh_token'), /connexion Gmail a expir/)
  assert.match(getSafeGmailErrorMessage('missing_refresh_token'), /connexion Gmail a expir/)
  assert.match(getSafeGmailErrorMessage('revoked_access'), /Reconnectez votre compte/)
  assert.match(getSafeGmailErrorMessage('google_temporary'), /Google est temporairement indisponible/)
})

test('gmail OAuth reconnect and disconnect routes preserve ownership and replace tokens', () => {
  const connectRoute = fs.readFileSync('app/api/gmail/connect/route.ts', 'utf8')
  const callbackRoute = fs.readFileSync('app/api/gmail/callback/route.ts', 'utf8')
  const gmailRoute = fs.readFileSync('app/api/gmail/route.ts', 'utf8')

  assert.match(connectRoute, /access_type:\s*'offline'/)
  assert.match(connectRoute, /prompt:\s*'consent'/)
  assert.match(connectRoute, /REQUIRED_GMAIL_DRAFT_SCOPE/)
  assert.doesNotMatch(connectRoute, /gmail\.send/)
  assert.match(connectRoute, /getServerSession\(authOptions\)/)
  assert.match(connectRoute, /createGmailOAuthState/)
  assert.match(connectRoute, /getStableGmailOAuthCallbackUrl\(\)/)
  assert.doesNotMatch(connectRoute, /code_challenge/)
  assert.doesNotMatch(connectRoute, /authorizationUrl\.toString\(\)/)
  assert.doesNotMatch(callbackRoute, /getServerSession\(authOptions\)/)
  assert.match(callbackRoute, /verifyGmailOAuthState\(state\)/)
  assert.match(callbackRoute, /getStableGmailOAuthCallbackUrl\(\)/)
  assert.match(callbackRoute, /where:\s*\{\s*id:\s*payload\.userId\s*\}/)
  assert.match(callbackRoute, /prisma\.googleAccount\.upsert/)
  assert.match(callbackRoute, /accessToken:\s*tokens\.access_token/)
  assert.match(callbackRoute, /refreshToken,/)
  assert.match(gmailRoute, /export async function DELETE/)
  assert.match(gmailRoute, /where:\s*\{\s*userId:\s*user\.id\s*\}/)
  assert.match(gmailRoute, /scope:\s*true/)
  assert.match(gmailRoute, /buildDisconnectedGmailStatus/)
})

test('gmail OAuth uses a stable Google callback for production and previews', () => {
  const productionEnv = {
    NODE_ENV: 'production',
    NEXTAUTH_URL: 'https://prospectube.vercel.app',
    NEXTAUTH_SECRET: 'test-secret',
  }
  const previewEnv = {
    NODE_ENV: 'production',
    NEXTAUTH_URL: 'https://prospectube-37ukqp2rr-llow.vercel.app',
    NEXTAUTH_SECRET: 'test-secret',
  }

  assert.equal(
    getStableGmailOAuthCallbackUrl(productionEnv),
    'https://prospectube.vercel.app/api/gmail/callback'
  )
  assert.equal(
    getStableGmailOAuthCallbackUrl(previewEnv),
    'https://prospectube.vercel.app/api/gmail/callback'
  )
})

test('gmail OAuth token exchange uses the exact same stable redirect uri', () => {
  const connectRoute = fs.readFileSync('app/api/gmail/connect/route.ts', 'utf8')
  const callbackRoute = fs.readFileSync('app/api/gmail/callback/route.ts', 'utf8')

  assert.match(connectRoute, /const redirectUri = getStableGmailOAuthCallbackUrl\(\)/)
  assert.match(callbackRoute, /const redirectUri = getStableGmailOAuthCallbackUrl\(\)/)
  assert.match(connectRoute, /redirect_uri:\s*redirectUri/)
  assert.match(callbackRoute, /redirect_uri:\s*redirectUri/)
})

test('gmail OAuth signed state preserves preview, production, campaign and localhost returns', () => {
  const env = { NODE_ENV: 'production', NEXTAUTH_SECRET: 'test-secret' }
  const previewState = createGmailOAuthState({
    userId: 'user_preview',
    origin: 'https://prospectube-37ukqp2rr-llow.vercel.app',
    returnPath: '/campaigns?campaignId=campaign_123',
  }, env)
  const previewPayload = verifyGmailOAuthState(previewState, env)
  assert.equal(previewPayload.userId, 'user_preview')
  assert.equal(previewPayload.origin, 'https://prospectube-37ukqp2rr-llow.vercel.app')
  assert.equal(previewPayload.returnPath, '/campaigns?campaignId=campaign_123')
  assert.equal(
    buildGmailOAuthStatusRedirect('connected', previewPayload, env).toString(),
    'https://prospectube-37ukqp2rr-llow.vercel.app/campaigns?campaignId=campaign_123&gmail=connected'
  )

  const productionState = createGmailOAuthState({
    userId: 'user_prod',
    origin: 'https://prospectube.vercel.app',
    returnPath: '/settings',
  }, env)
  const productionPayload = verifyGmailOAuthState(productionState, env)
  assert.equal(
    buildGmailOAuthStatusRedirect('connected', productionPayload, env).toString(),
    'https://prospectube.vercel.app/settings?gmail=connected'
  )

  const localEnv = { NODE_ENV: 'development', NEXTAUTH_SECRET: 'test-secret' }
  const localState = createGmailOAuthState({
    userId: 'user_local',
    origin: 'http://localhost:3000',
    returnPath: '/settings',
  }, localEnv)
  const localPayload = verifyGmailOAuthState(localState, localEnv)
  assert.equal(
    buildGmailOAuthStatusRedirect('connected', localPayload, localEnv).toString(),
    'http://localhost:3000/settings?gmail=connected'
  )
})

test('gmail OAuth return validation blocks open redirects and fake domains', () => {
  const productionEnv = { NODE_ENV: 'production', NEXTAUTH_SECRET: 'test-secret' }
  const devEnv = { NODE_ENV: 'development', NEXTAUTH_SECRET: 'test-secret' }

  assert.equal(isAllowedProspectTubeReturnOrigin('https://prospectube.vercel.app', productionEnv), true)
  assert.equal(isAllowedProspectTubeReturnOrigin('https://prospectube-37ukqp2rr-llow.vercel.app', productionEnv), true)
  assert.equal(isAllowedProspectTubeReturnOrigin('http://localhost:3000', devEnv), true)
  assert.equal(isAllowedProspectTubeReturnOrigin('https://evil.com', productionEnv), false)
  assert.equal(isAllowedProspectTubeReturnOrigin('javascript:alert(1)', productionEnv), false)
  assert.equal(isAllowedProspectTubeReturnOrigin('data:text/html,hi', productionEnv), false)
  assert.equal(isAllowedProspectTubeReturnOrigin('https://prospectube.vercel.app.evil.com', productionEnv), false)
  assert.equal(isAllowedProspectTubeReturnOrigin('https://evil-prospectube.vercel.app', productionEnv), false)
  assert.equal(getSafeGmailOAuthReturnPath('https://evil.com/settings'), '/settings')
  assert.equal(getSafeGmailOAuthReturnPath('//evil.com/settings'), '/settings')
})

test('gmail OAuth state rejects tampering and stale payloads', () => {
  const env = { NODE_ENV: 'production', NEXTAUTH_SECRET: 'test-secret' }
  const state = createGmailOAuthState({
    userId: 'user_123',
    origin: 'https://prospectube.vercel.app',
    returnPath: '/settings',
  }, env)

  assert.equal(verifyGmailOAuthState(`${state}tampered`, env), null)
  assert.equal(verifyGmailOAuthState(state, { ...env, NEXTAUTH_SECRET: 'other-secret' }), null)
  assert.equal(verifyGmailOAuthState(state, env, Date.now() + 11 * 60 * 1000), null)
})

test('gmail OAuth request origin keeps the initial Vercel preview origin', () => {
  assert.equal(getRequestOriginFromParts({
    forwardedHost: 'prospectube-37ukqp2rr-llow.vercel.app',
    forwardedProto: 'https',
    host: 'internal.vercel.app',
    fallbackOrigin: 'https://internal.vercel.app',
  }), 'https://prospectube-37ukqp2rr-llow.vercel.app')
})

test('gmail status requires the draft compose scope before enabling Gmail drafts', () => {
  const missingScope = buildGmailStatus({
    email: 'creator@gmail.com',
    refreshToken: 'refresh-token',
    scope: 'openid email profile',
    expiryDate: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }, 'draft')

  assert.equal(missingScope.connected, false)
  assert.equal(missingScope.status, 'expired')
  assert.equal(missingScope.canUseGmail, false)
  assert.match(missingScope.message, /autorisation Gmail actuelle/)
  assert.equal(shouldDisableGmailDrafts(missingScope), true)
})

test('settings and campaigns read the same uncached Gmail status endpoint', () => {
  const settingsPage = fs.readFileSync('app/settings/page.tsx', 'utf8')
  const campaignsPage = fs.readFileSync('app/campaigns/page.tsx', 'utf8')
  const gmailRoute = fs.readFileSync('app/api/gmail/route.ts', 'utf8')

  assert.match(settingsPage, /fetch\('\/api\/gmail', \{ cache: 'no-store' \}\)/)
  assert.match(campaignsPage, /fetch\('\/api\/gmail', \{ cache: 'no-store' \}\)/)
  assert.match(gmailRoute, /Cache-Control': 'no-store, max-age=0'/)
  assert.match(gmailRoute, /buildGmailStatus\(account, SEND_MODE/)
})

test('campaign V1 interface does not expose AI generation controls', () => {
  const campaignsPage = fs.readFileSync('app/campaigns/page.tsx', 'utf8')

  assert.doesNotMatch(campaignsPage, /CAMPAIGN_AI_ENABLED/)
  assert.doesNotMatch(campaignsPage, /generateCampaignEmails/)
  assert.doesNotMatch(campaignsPage, /generatingIds/)
  assert.doesNotMatch(campaignsPage, /\/generate/)
  assert.doesNotMatch(campaignsPage, /Générer avec/)
  assert.doesNotMatch(campaignsPage, /Contact manuel/)
  assert.doesNotMatch(campaignsPage, /Message incomplet/)
  assert.doesNotMatch(campaignsPage, /Envoyer la sélection/)
  assert.match(campaignsPage, /Aucune adresse email disponible/)
  assert.match(campaignsPage, /À compléter/)
  assert.match(campaignsPage, /Prospects sans adresse email/)
  assert.match(campaignsPage, /Créer les brouillons Gmail/)
  assert.match(campaignsPage, /noEmailProspects\.map/)
  assert.match(campaignsPage, /<ProspectPresentation/)
})

test('gmail MIME uses required headers and base64url encoding', () => {
  const raw = encodeGmailMessage({
    to: 'creator@example.com',
    subject: 'Collaboration vidéo',
    body: 'Bonjour Thomas',
  })

  assert.doesNotMatch(raw, /[+/=]/)
  const decoded = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  assert.match(decoded, /To: creator@example\.com/)
  assert.match(decoded, /Subject: =\?UTF-8\?B\?/)
  assert.match(decoded, /MIME-Version: 1\.0/)
  assert.match(decoded, /Content-Type: text\/plain; charset="UTF-8"/)
  assert.match(decoded, /Bonjour Thomas/)
})

test('gmail draft validation rejects invalid payloads before calling Gmail', () => {
  assert.throws(() => encodeGmailMessage({ to: '', subject: 'Sujet', body: 'Message' }), /GMAIL_DRAFT_INVALID/)
  assert.throws(() => encodeGmailMessage({ to: 'creator@example.com', subject: '', body: 'Message' }), /GMAIL_DRAFT_INVALID/)
  assert.throws(() => encodeGmailMessage({ to: 'creator@example.com', subject: 'Sujet', body: '   ' }), /GMAIL_DRAFT_INVALID/)
})

test('campaign send route returns functional Gmail error codes', () => {
  const sendRoute = fs.readFileSync('app/api/campaigns/[id]/send/route.ts', 'utf8')

  for (const code of [
    'GMAIL_NOT_CONNECTED',
    'GMAIL_CONNECTION_EXPIRED',
    'GMAIL_SCOPE_MISSING',
    'GMAIL_API_NOT_ENABLED',
    'GMAIL_RATE_LIMITED',
    'GMAIL_DRAFT_INVALID',
    'GMAIL_API_REJECTED',
    'GMAIL_TEMPORARY_ERROR',
  ]) {
    assert.match(sendRoute, new RegExp(code))
  }

  assert.match(sendRoute, /forceRefresh: true/)
  assert.doesNotMatch(sendRoute, /Erreur Gmail/)
})

test('prospect presentation normalizes media, contacts and fallback identity', () => {
  const withAvatarUrl = {
    name: 'Creator One',
    avatar: 'https://cdn.example.com/avatar.jpg',
    thumbnail: 'https://cdn.example.com/thumb.jpg',
    email: 'creator@example.com',
    instagram: 'https://instagram.com/creator',
    score: 83,
    scoreLabel: 'Excellent prospect',
    subsNum: 42000,
    totalViews: 1200000,
    videoCount: 134,
    createdAt: '2021-03-01T00:00:00.000Z',
  }
  const data = normalizeProspectPresentation(withAvatarUrl)

  assert.equal(getProspectImageUrl(withAvatarUrl), 'https://cdn.example.com/avatar.jpg')
  assert.equal(data.name, 'Creator One')
  assert.equal(data.score, 83)
  assert.deepEqual(data.stats, ['42K abonnes', '1.2M vues', '134 videos', 'cree en 2021'])
  assert.deepEqual(data.contacts.map(contact => contact.key), ['email', 'instagram'])
})

test('prospect presentation uses thumbnail before initials when avatar is not an image', () => {
  assert.equal(getProspectImageUrl({
    name: 'Creator Two',
    avatar: 'CT',
    thumbnail: 'https://cdn.example.com/thumb.jpg',
  }), 'https://cdn.example.com/thumb.jpg')

  assert.equal(getProspectInitials('Creator Two', 'CT'), 'CT')
  assert.equal(normalizeProspectPresentation({ name: 'Creator Two', avatar: null, thumbnail: null }).initials, 'CT')
})

test('prospect presentation image fallback keeps campaign cards visually stable', () => {
  assert.equal(getProspectImageUrl({
    avatar: null,
    thumbnail: null,
    imageUrl: 'https://yt.example.com/image.jpg',
  }), 'https://yt.example.com/image.jpg')

  const fallback = normalizeProspectPresentation({
    name: 'Fallback Creator',
    avatar: null,
    thumbnail: null,
    imageUrl: null,
  })

  assert.equal(fallback.imageUrl, null)
  assert.equal(fallback.initials, 'FC')
})

test('main app navigation uses the shared premium labels and emojis', () => {
  const nav = fs.readFileSync('components/MainAppNav.tsx', 'utf8')
  const signOut = fs.readFileSync('components/HomeSignOutButton.tsx', 'utf8')

  for (const label of [
    '🏠 Accueil',
    '⭐ Favoris',
    '🕘 Historique',
    '🎯 Campagnes',
    '🔍 Nouvelle recherche',
    '⚙️ Paramètres',
    '⭐ Plan {plan}',
  ]) {
    assert.match(nav, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.match(signOut, /🚪 Déconnexion/)
})

test('gmail send summary stays clear when Gmail is not needed for ineligible prospects', () => {
  const summary = getCampaignSendSummary([
    { success: false, skippedReason: 'no_email' },
    { success: false, skippedReason: 'incomplete_message' },
    { success: false, skippedReason: 'already_processed' },
  ])

  assert.equal(summary.successCount, 0)
  assert.equal(summary.skippedNoEmailCount, 1)
  assert.equal(summary.skippedIncompleteCount, 1)
  assert.equal(summary.skippedAlreadyProcessedCount, 1)
  assert.equal(summary.campaignResultStatus, 'Aucun email envoye')
})

test('campaign send route returns structured draft states and avoids duplicate Gmail drafts', () => {
  const sendRoute = fs.readFileSync('app/api/campaigns/[id]/send/route.ts', 'utf8')

  assert.match(sendRoute, /gmailMessageId:\s*true/)
  assert.match(sendRoute, /DRAFT_CREATED/)
  assert.match(sendRoute, /DRAFT_CREATED_STATUS_RECOVERED/)
  assert.match(sendRoute, /DRAFT_ALREADY_CREATED/)
  assert.match(sendRoute, /DRAFT_CREATED_STATUS_NOT_SAVED/)
  assert.match(sendRoute, /getStructuredDraftState\(results\)/)
  assert.match(sendRoute, /alreadyProcessed \? undefined : getSkipMessage/)
  assert.match(sendRoute, /Tous les brouillons eligibles existent deja/)
})

test('campaign send route logs Prisma persistence failures and retries a minimal status update', () => {
  const sendRoute = fs.readFileSync('app/api/campaigns/[id]/send/route.ts', 'utf8')

  assert.match(sendRoute, /Prisma\.PrismaClientKnownRequestError/)
  assert.match(sendRoute, /prismaCode/)
  assert.match(sendRoute, /prismaMessage/)
  assert.match(sendRoute, /failingOperation/)
  assert.match(sendRoute, /stack/)
  assert.match(sendRoute, /gmailDraftId/)
  assert.match(sendRoute, /gmailMessageId/)
  assert.match(sendRoute, /campaignProspect\.updateMany/)
  assert.match(sendRoute, /campaignId:\s*input\.campaignId/)
  assert.match(sendRoute, /campaignProspect\.updateMany\.deliveryStatusFull/)
  assert.match(sendRoute, /campaignProspect\.updateMany\.deliveryStatusMinimal/)
  assert.match(sendRoute, /sendError:\s*null/)
  assert.match(sendRoute, /sentAt:\s*input\.sentAt/)
  assert.match(sendRoute, /data:\s*\{\s*sendStatus:\s*input\.sendStatus,\s*gmailMessageId/s)
  assert.match(sendRoute, /DRAFT_CREATED_STATUS_NOT_SAVED/)
  assert.doesNotMatch(sendRoute, /where:\s*\{\s*id:\s*prospect\.id\s*\},\s*data:\s*\{\s*sendStatus,\s*sentAt/s)
})

test('stripe config accepts price ids and trims spaces', () => {
  assert.equal(validateStripePriceId('price_123'), 'price_123')
  assert.equal(validateStripePriceId('  price_123  '), 'price_123')

  const config = getValidatedStripeConfig({
    STRIPE_SECRET_KEY: 'sk_live_secret',
    STRIPE_PRICE_PRO: '  price_live_pro  ',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_public',
  })

  assert.equal(config.mode, 'live')
  assert.equal(config.priceId, 'price_live_pro')
})

test('stripe config rejects secret keys or promotions in STRIPE_PRICE_PRO', () => {
  for (const invalidPrice of ['sk_live_secret', 'sk_test_secret', 'prod_123', 'coupon_123', 'promo_123', 'abc_123']) {
    assert.throws(
      () => validateStripePriceId(invalidPrice),
      error => error instanceof StripeConfigError && error.code === 'STRIPE_PRICE_PRO_INVALID'
    )
  }
})

test('stripe config detects secret and publishable mode mismatch', () => {
  assert.throws(
    () => getValidatedStripeConfig({
      STRIPE_SECRET_KEY: 'sk_live_secret',
      STRIPE_PRICE_PRO: 'price_123',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_public',
    }),
    error => error instanceof StripeConfigError && error.code === 'STRIPE_MODE_MISMATCH'
  )
})

function mockStripePrice(overrides = {}) {
  return {
    id: 'price_123',
    livemode: false,
    active: true,
    recurring: { interval: 'month' },
    currency: 'eur',
    unit_amount: 490,
    ...overrides,
  }
}

test('stripe price validation detects live and test mode mismatches', () => {
  assert.throws(
    () => validateStripePriceForPro(mockStripePrice({ livemode: false }), 'live'),
    error => error instanceof StripeConfigError && error.code === 'STRIPE_MODE_MISMATCH'
  )
  assert.throws(
    () => validateStripePriceForPro(mockStripePrice({ livemode: true }), 'test'),
    error => error instanceof StripeConfigError && error.code === 'STRIPE_MODE_MISMATCH'
  )
})

test('stripe price validation rejects inactive, wrong interval, currency and amount', () => {
  assert.throws(
    () => validateStripePriceForPro(mockStripePrice({ active: false }), 'test'),
    error => error instanceof StripeConfigError && error.code === 'STRIPE_PRICE_INACTIVE'
  )
  assert.throws(
    () => validateStripePriceForPro(mockStripePrice({ recurring: { interval: 'year' } }), 'test'),
    error => error instanceof StripeConfigError && error.code === 'STRIPE_PRICE_INTERVAL_INVALID'
  )
  assert.throws(
    () => validateStripePriceForPro(mockStripePrice({ currency: 'usd' }), 'test'),
    error => error instanceof StripeConfigError && error.code === 'STRIPE_PRICE_CURRENCY_INVALID'
  )
  assert.throws(
    () => validateStripePriceForPro(mockStripePrice({ unit_amount: 495 }), 'test'),
    error => error instanceof StripeConfigError && error.code === 'STRIPE_PRICE_AMOUNT_INVALID'
  )
})

test('stripe missing price maps to a safe client error without secrets', () => {
  const error = toStripeConfigError({
    code: 'resource_missing',
    type: 'StripeInvalidRequestError',
    requestId: 'req_123',
    message: "No such price: 'price_missing'",
  })
  error.priceId = 'price_missing'
  error.mode = 'live'

  const log = getSafeStripeConfigLog(error)
  const serialized = JSON.stringify({ client: STRIPE_CLIENT_ERROR_MESSAGE, log })

  assert.equal(error.code, 'STRIPE_PRICE_NOT_FOUND')
  assert.equal(log.stripeRequestId, 'req_123')
  assert.doesNotMatch(serialized, /sk_live_|sk_test_/)
  assert.doesNotMatch(STRIPE_CLIENT_ERROR_MESSAGE, /No such price/)
})

test('stripe checkout route verifies price before session and hides raw Stripe errors', () => {
  const checkoutRoute = fs.readFileSync('app/api/stripe/checkout/route.ts', 'utf8')
  const stripeHelper = fs.readFileSync('lib/stripeConfig.ts', 'utf8')
  const packageJson = fs.readFileSync('package.json', 'utf8')

  assert.match(checkoutRoute, /stripe\.accounts\.retrieve\(null\)/)
  assert.match(checkoutRoute, /stripe\.prices\.retrieve\(priceId\)/)
  assert.match(checkoutRoute, /validateStripePriceForPro\(price, mode\)/)
  assert.match(checkoutRoute, /STRIPE_CLIENT_ERROR_MESSAGE/)
  assert.doesNotMatch(checkoutRoute, /No such price/)
  assert.match(stripeHelper, /STRIPE_PRICE_NOT_FOUND/)
  assert.match(packageJson, /"stripe:check": "node scripts\/check-stripe-config\.mjs"/)
})

test('youtube quota errors are converted to safe 429 responses', () => {
  for (const reason of ['quotaExceeded', 'dailyLimitExceeded']) {
    const error = classifyYouTubeError({
      endpoint: 'search.list',
      status: 403,
      payload: {
        error: {
          message: "Quota exceeded for quota metric 'Search Queries' and project/secret.",
          errors: [{ reason }],
        },
      },
    })
    const response = buildYouTubeErrorResponse(error)
    const serialized = JSON.stringify(response)

    assert.equal(response.status, 429)
    assert.equal(response.body.error, 'YOUTUBE_DAILY_QUOTA_EXCEEDED')
    assert.equal(response.body.message, YOUTUBE_DAILY_QUOTA_MESSAGE)
    assert.equal(response.body.retryable, true)
    assert.doesNotMatch(serialized, /Quota exceeded for quota metric/)
    assert.doesNotMatch(serialized, /project\/secret/)
  }
})

test('youtube rate limit and backend errors are classified without exposing Google details', () => {
  const rateLimited = classifyYouTubeError({
    endpoint: 'channels.list',
    status: 403,
    payload: { error: { message: 'User rate limited', errors: [{ reason: 'userRateLimitExceeded' }] } },
  })
  const backend = classifyYouTubeError({
    endpoint: 'search.list',
    status: 503,
    payload: { error: { message: 'Backend error', errors: [{ reason: 'backendError' }] } },
  })

  assert.equal(buildYouTubeErrorResponse(rateLimited).status, 429)
  assert.equal(buildYouTubeErrorResponse(rateLimited).body.error, 'YOUTUBE_RATE_LIMITED')
  assert.equal(buildYouTubeErrorResponse(backend).status, 503)
  assert.equal(buildYouTubeErrorResponse(backend).body.error, 'YOUTUBE_BACKEND_ERROR')
  assert.deepEqual(getSafeYouTubeLog(rateLimited), {
    code: 'YOUTUBE_RATE_LIMITED',
    reason: 'userRateLimitExceeded',
    endpoint: 'channels.list',
    httpStatus: 403,
    retryable: true,
  })
})

test('youtube error sanitation removes api keys and project identifiers', () => {
  const sanitized = sanitizeGoogleMessage(
    'Request failed for projects/123456?key=AIzaSecretKey and key=AIzaAnotherSecret'
  )

  assert.doesNotMatch(sanitized, /AIzaSecretKey|AIzaAnotherSecret|projects\/123456/)
})

test('youtube configuration errors are classified precisely and stay safe for clients', () => {
  const cases = [
    [{ error: { message: 'API key not valid. Please pass a valid API key.', errors: [{ reason: 'keyInvalid' }] } }, 'YOUTUBE_KEY_INVALID'],
    [{ error: { message: 'API has not been used in project', errors: [{ reason: 'accessNotConfigured' }] } }, 'YOUTUBE_API_DISABLED'],
    [{ error: { message: 'Requests from referer are blocked', errors: [{ reason: 'ipRefererBlocked' }] } }, 'YOUTUBE_KEY_RESTRICTED'],
  ]

  for (const [payload, expectedCode] of cases) {
    const error = classifyYouTubeError({ payload, status: 403, endpoint: 'search.list' })
    const response = buildYouTubeErrorResponse(error)
    assert.equal(error.code, expectedCode)
    assert.equal(response.status, 503)
    assert.equal(response.body.message, YOUTUBE_CONFIGURATION_MESSAGE)
    assert.doesNotMatch(JSON.stringify(response), /referer|API key not valid|project/i)
  }
})

test('youtube detects project mismatch, timeout and never exposes credentials', () => {
  const mismatch = classifyYouTubeError({
    payload: {
      error: {
        message: 'Consumer projects/123456789 is not allowed with key=AIzaHiddenSecret123456789',
        errors: [{ reason: 'forbidden' }],
      },
    },
    status: 403,
    endpoint: 'search.list',
    expectedProjectNumber: '987654321',
  })
  const timeout = classifyYouTubeError({ endpoint: 'search.list', timedOut: true })

  assert.equal(mismatch.code, 'YOUTUBE_PROJECT_MISMATCH')
  assert.equal(getSafeYouTubeLog(mismatch).consumerProjectNumber, '123456789')
  assert.equal(timeout.code, 'YOUTUBE_TIMEOUT')
  assert.equal(buildYouTubeErrorResponse(timeout).status, 503)
  assert.doesNotMatch(JSON.stringify(buildYouTubeErrorResponse(mismatch)), /123456789|AIza/)
})

test('youtube language labels normalize to ISO 639-1 codes', () => {
  for (const [input, expected] of [
    ['Français', 'fr'],
    ['francais', 'fr'],
    ['fr', 'fr'],
    ['Anglais', 'en'],
    ['english', 'en'],
    ['Español', 'es'],
    ['Allemand', 'de'],
    ['Italiano', 'it'],
    ['Português', 'pt'],
  ]) {
    assert.equal(normalizeYouTubeLanguage(input), expected)
  }
  assert.equal(normalizeYouTubeLanguage(''), null)
  assert.equal(normalizeYouTubeLanguage('langue-inconnue'), null)
})

test('youtube query variants are deterministic, unique and limited to three', () => {
  assert.deepEqual(buildYouTubeQueryVariants(' Gaming ', 'Français'), ['Gaming français', 'Gaming video français'])
  assert.deepEqual(buildYouTubeQueryVariants('Gaming français', 'fr'), ['Gaming français'])
  assert.deepEqual(buildYouTubeQueryVariants('Immobilier', 'Klingon'), ['Immobilier'])
  assert.equal(buildYouTubeQueryVariants('Gaming', 'Français').length <= MAX_YOUTUBE_SEARCH_QUERIES, true)
})

test('subniche discovery produces useful deterministic French queries', () => {
  const fortnite = { niche: 'Gaming', subNiches: ['Fortnite'], customKeyword: '', language: 'Français' }
  assert.equal(getPrimarySearchFocus(fortnite), 'Fortnite')
  assert.equal(getSearchFocusVariant(fortnite), 'gameplay fortnite')
  assert.deepEqual(buildYouTubeQueryVariants(getPrimarySearchFocus(fortnite), fortnite.language, getSearchFocusVariants(fortnite)), ['Fortnite français', 'gameplay fortnite français', 'chaine fortnite francaise'])
  assert.ok(getSubnicheVocabulary('Mode homme').includes('style masculin'))
})

test('YouTube discovery always uses all three complementary queries', () => {
  assert.equal(MAX_SEARCH_LIST_CALLS, 3)
  assert.equal(MAX_YOUTUBE_SEARCH_QUERIES, 3)
  assert.equal(shouldRunNextYouTubeQuery({ queriesUsed: 1, totalVariants: 3 }), true)
  assert.equal(shouldRunNextYouTubeQuery({ queriesUsed: 2, totalVariants: 3 }), true)
  assert.equal(shouldRunNextYouTubeQuery({ queriesUsed: 3, totalVariants: 3 }), false)
  assert.equal(shouldRunNextYouTubeQuery({ queriesUsed: 2, totalVariants: 2 }), false)
})

test('adaptive YouTube IDs are deduplicated and only new channels are enriched', () => {
  const known = new Set()
  const first = collectNewYouTubeChannelIds([
    { snippet: { channelId: 'one' } },
    { snippet: { channelId: 'two' } },
    { snippet: { channelId: 'one' } },
  ], known)
  const second = collectNewYouTubeChannelIds([
    { snippet: { channelId: 'two' } },
    { snippet: { channelId: 'three' } },
  ], known)

  assert.deepEqual(first, ['one', 'two'])
  assert.deepEqual(second, ['three'])
  assert.equal(known.size, 3)
})

test('three complementary result sets can build a broad unique channel catalog', () => {
  const known = new Set()
  const batches = [
    Array.from({ length: 50 }, (_, index) => ({ snippet: { channelId: `strict-${index}` } })),
    Array.from({ length: 50 }, (_, index) => ({ snippet: { channelId: index < 10 ? `strict-${index}` : `format-${index}` } })),
    Array.from({ length: 50 }, (_, index) => ({ snippet: { channelId: index < 10 ? `format-${index + 10}` : `broad-${index}` } })),
  ]
  const discovered = batches.flatMap(batch => collectNewYouTubeChannelIds(batch, known))
  assert.equal(discovered.length, 130)
  assert.equal(known.size, 130)
})

test('subscriber range analysis excludes hidden, low and oversized channels', () => {
  const analysis = analyzeYouTubeChannelRange([
    { id: 'hidden', statistics: { hiddenSubscriberCount: true } },
    { id: 'missing', statistics: {} },
    { id: 'low', statistics: { subscriberCount: '9999' } },
    { id: 'accepted', statistics: { subscriberCount: '42000' } },
    { id: 'high', statistics: { subscriberCount: '100001' } },
  ], 10000, 100000)

  assert.deepEqual(analysis.accepted.map(channel => channel.id), ['accepted'])
  assert.equal(analysis.hiddenSubscribers, 2)
  assert.equal(analysis.belowMinimum, 1)
  assert.equal(analysis.aboveMaximum, 1)
})

test('youtube channel search parameters are valid for Gaming in French', () => {
  const params = buildYouTubeSearchParams({
    query: 'gaming gameplay streamer français',
    language: 'Français',
    maxResults: 50,
    fields: 'items(snippet(channelId,title)),nextPageToken',
  })

  assert.equal(params.get('part'), 'snippet')
  assert.equal(params.get('type'), 'channel')
  assert.equal(params.get('maxResults'), '50')
  assert.equal(params.get('relevanceLanguage'), 'fr')
  assert.equal(params.has('regionCode'), false)
  assert.equal(Array.from(params.keys()).some(name => /^video/i.test(name)), false)
  assert.equal(params.has('minSubscribers'), false)
  assert.equal(params.has('maxSubscribers'), false)
})

test('empty or unknown language is never sent raw to YouTube', () => {
  for (const language of ['', 'Klingon']) {
    const params = buildYouTubeSearchParams({
      query: 'gaming',
      language,
      fields: 'items(snippet(channelId))',
    })
    assert.equal(params.has('relevanceLanguage'), false)
    assert.doesNotMatch(params.toString(), /Klingon/i)
  }
})

test('youtube search rejects maxResults outside the supported range', () => {
  for (const maxResults of [0, 51, 1.5]) {
    assert.throws(
      () => buildYouTubeSearchParams({ query: 'gaming', maxResults, fields: 'items' }),
      /YOUTUBE_SEARCH_MAX_RESULTS_INVALID/
    )
  }
})

test('invalid YouTube search parameters return a safe 400 response', () => {
  for (const reason of ['invalidParameter', 'invalidRelevanceLanguage', 'invalidSearchFilter']) {
    const error = classifyYouTubeError({
      endpoint: 'search.list',
      status: 400,
      payload: { error: { message: 'Invalid value supplied by caller', errors: [{ reason }] } },
    })
    const response = buildYouTubeErrorResponse(error)
    assert.equal(response.status, 400)
    assert.equal(response.body.error, 'YOUTUBE_INVALID_SEARCH_PARAMETERS')
    assert.equal(response.body.message, YOUTUBE_INVALID_SEARCH_PARAMETERS_MESSAGE)
    assert.doesNotMatch(JSON.stringify(response), /Invalid value supplied by caller/)
  }
})

test('safe YouTube parameter logs omit keys, URLs and query contents', () => {
  const params = buildYouTubeSearchParams({
    query: 'private query text',
    language: 'fr',
    fields: 'items(snippet(channelId))',
  })
  params.set('key', 'AIzaSecretValueThatMustNeverAppear')
  const log = getSafeYouTubeSearchParamsLog(params)
  const serialized = JSON.stringify(log)

  assert.deepEqual(log.parameterNames, ['fields', 'maxResults', 'order', 'part', 'q', 'relevanceLanguage', 'type'])
  assert.equal(log.queryLength, 18)
  assert.doesNotMatch(serialized, /AIza|private query|googleapis|key=/i)
})

test('discovery catalog keys are shared across subscriber ranges and remain versioned', () => {
  const first = buildSearchCacheKey({ niche: ' Cuisine ', lang: 'Français', subsMin: 10000, subsMax: 50000 })
  const second = buildSearchCacheKey({ niche: 'cuisine', lang: '  francais  ', subsMin: 10000, subsMax: 50000 })
  const different = buildSearchCacheKey({ niche: 'cuisine', lang: 'francais', subsMin: 10000, subsMax: 100000 })

  assert.equal(first, second)
  assert.equal(first, different)
  assert.match(first, new RegExp(`^${SEARCH_CACHE_VERSION}:`))
  assert.equal(SEARCH_CACHE_VERSION, 'youtube-search-v8')
  assert.equal(normalizeSearchText('  Création   vidéo  '), 'creation-video')
})

test('catalog filtering applies subscriber ranges locally without changing discovery data', () => {
  const catalog = { channels: [
    { id: 'low', subsNum: 20000, score: 40 },
    { id: 'middle', subsNum: 75000, score: 80 },
    { id: 'high', subsNum: 300000, score: 60 },
  ] }
  assert.deepEqual(filterYouTubeCatalog(catalog, 10000, 50000, 20).map(item => item.id), ['low'])
  assert.deepEqual(filterYouTubeCatalog(catalog, 10000, 100000, 20).map(item => item.id), ['middle', 'low'])
  assert.equal(catalog.channels.length, 3)
})

test('catalog channels are deduplicated with newly collected values winning', () => {
  assert.deepEqual(mergeCatalogChannels(
    [{ id: 'one', score: 1 }, { id: 'two', score: 2 }],
    [{ id: 'two', score: 20 }, { id: 'three', score: 3 }]
  ), [{ id: 'one', score: 1 }, { id: 'two', score: 20 }, { id: 'three', score: 3 }])
})

test('catalog policy uses 48h TTL, 12h poor refresh and 1h negative cache', () => {
  assert.equal(SEARCH_CACHE_TTL_HOURS, 48)
  assert.equal(SEARCH_CATALOG_POOR_REFRESH_HOURS, 12)
  assert.equal(SEARCH_NEGATIVE_CACHE_TTL_HOURS, 1)
  const now = new Date('2026-08-02T12:00:00.000Z')
  assert.equal(getCatalogAgeHours('2026-08-02T00:00:00.000Z', now), 12)
  assert.equal(shouldEnrichSearchCatalog({ candidateCount: 20, filteredResultCount: 9, collectedAt: '2026-08-02T00:00:00.000Z', now }), true)
  assert.equal(shouldEnrichSearchCatalog({ candidateCount: 20, filteredResultCount: 9, collectedAt: '2026-08-02T01:00:00.000Z', now }), false)
  assert.equal(shouldEnrichSearchCatalog({ candidateCount: 20, filteredResultCount: 20, collectedAt: '2026-08-01T00:00:00.000Z', now }), false)
})

test('product search limits are centralized and reset Pro usage by UTC day', () => {
  assert.equal(FREE_LIFETIME_SEARCH_LIMIT, 3)
  assert.equal(PRO_DAILY_SEARCH_LIMIT, 5)
  assert.equal(getUtcDayKey(new Date('2026-08-02T23:59:59.000Z')), '2026-08-02')
  assert.equal(getUtcDayKey(new Date('2026-08-03T00:00:00.000Z')), '2026-08-03')
  assert.match(getSearchQuotaMessage('Gratuit', 1), /1 recherche gratuite/)
  assert.match(getSearchQuotaMessage('Gratuit', 0), /Passez au Plan Pro/)
  assert.match(getSearchQuotaMessage('Pro', 5), /5 recherche/)
})

test('free quota gives new and reset legacy accounts three searches regardless of history', async () => {
  const freshDb = {
    user: { findUnique: async () => ({ searchesRemaining: 3 }) },
  }
  const legacyDb = {
    user: { findUnique: async () => ({ searchesRemaining: 3 }) },
    search: { count: async () => 99 },
    searchUsage: { count: async () => 99 },
  }

  assert.deepEqual(await getSearchQuotaSnapshot(freshDb, 'user-free', 'Gratuit'), {
    limit: 3, used: 0, remaining: 3, periodKey: FREE_SEARCH_PERIOD_KEY,
  })
  assert.deepEqual(await getSearchQuotaSnapshot(legacyDb, 'legacy-free', 'Gratuit'), {
    limit: 3, used: 0, remaining: 3, periodKey: FREE_SEARCH_PERIOD_KEY,
  })
})

test('free quota is always clamped between zero and three', async () => {
  for (const [stored, remaining] of [[-4, 0], [0, 0], [1, 1], [2, 2], [3, 3], [8, 3]]) {
    const db = { user: { findUnique: async () => ({ searchesRemaining: stored }) } }
    const snapshot = await getSearchQuotaSnapshot(db, 'legacy-user', 'Gratuit')
    assert.equal(snapshot.remaining, remaining)
    assert.ok(snapshot.remaining >= 0)
    assert.ok(snapshot.remaining <= FREE_LIFETIME_SEARCH_LIMIT)
  }
})

test('free quota backfill is versioned, idempotent and excludes Pro accounts', () => {
  const migration = fs.readFileSync('prisma/migrations/20260805120000_reset_existing_free_search_quota/migration.sql', 'utf8')
  const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')
  assert.equal(FREE_SEARCH_QUOTA_VERSION, 1)
  assert.match(FREE_SEARCH_PERIOD_KEY, /free-lifetime-v1/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "freeSearchQuotaVersion"/)
  assert.match(migration, /"freeSearchQuotaVersion" < 1/)
  assert.match(migration, /LOWER\(BTRIM\("plan"\)\) <> 'pro'/)
  assert.match(migration, /"searchesRemaining" = 3/)
  assert.match(migration, /"freeSearchQuotaVersion" = 1/)
  assert.match(schema, /searchesRemaining\s+Int\s+@default\(3\)/)
  assert.match(schema, /freeSearchQuotaVersion\s+Int\s+@default\(1\)/)
  assert.doesNotMatch(migration, /DELETE|DROP|TRUNCATE/i)
})

function createFreeQuotaPrisma(initialRemaining = 3) {
  let remaining = initialRemaining
  const usages = new Map()
  const tx = {
    user: {
      findUnique: async () => ({ searchesRemaining: remaining }),
      updateMany: async ({ where, data }) => {
        if (where.searchesRemaining?.gt !== undefined && remaining <= where.searchesRemaining.gt) return { count: 0 }
        if (where.searchesRemaining?.lt !== undefined && remaining >= where.searchesRemaining.lt) return { count: 0 }
        remaining = typeof data.searchesRemaining === 'number'
          ? data.searchesRemaining
          : remaining + (data.searchesRemaining?.increment || 0)
        return { count: 1 }
      },
    },
    searchUsage: {
      findUnique: async ({ where }) => usages.get(where.requestId) || null,
      findFirst: async ({ where }) => {
        const usage = usages.get(where.requestId)
        return usage?.status === where.status ? usage : null
      },
      create: async ({ data }) => { usages.set(data.requestId, { ...data }); return data },
      deleteMany: async ({ where }) => {
        const usage = usages.get(where.requestId)
        if (!usage || usage.status !== where.status) return { count: 0 }
        usages.delete(where.requestId)
        return { count: 1 }
      },
    },
  }
  return {
    prisma: { ...tx, $transaction: async callback => callback(tx) },
    getRemaining: () => remaining,
  }
}

test('free quota allows three reservations, blocks the fourth and restores failed work', async () => {
  const state = createFreeQuotaPrisma(3)
  for (let index = 1; index <= 3; index += 1) {
    const result = await reserveSearchQuota({ prisma: state.prisma, userId: 'free', requestId: `request-${index}`, cacheKey: 'cache', plan: 'Gratuit' })
    assert.equal(result.reserved, true)
  }
  const blocked = await reserveSearchQuota({ prisma: state.prisma, userId: 'free', requestId: 'request-4', cacheKey: 'cache', plan: 'Gratuit' })
  assert.equal(blocked.reserved, false)
  assert.equal(blocked.snapshot.remaining, 0)
  assert.equal(state.getRemaining(), 0)

  const releasedState = createFreeQuotaPrisma(3)
  await reserveSearchQuota({ prisma: releasedState.prisma, userId: 'free', requestId: 'failed-request', cacheKey: 'cache', plan: 'Gratuit' })
  assert.equal(releasedState.getRemaining(), 2)
  await releaseSearchQuota(releasedState.prisma, 'failed-request')
  assert.equal(releasedState.getRemaining(), 3)
})

test('pro quota allows five successes, blocks the sixth and uses the UTC window', async () => {
  let usageCount = 5
  let capturedWhere
  const db = {
    search: { count: async () => 0 },
    searchUsage: { count: async ({ where }) => { capturedWhere = where; return usageCount } },
  }
  const now = new Date('2026-08-02T18:30:00.000Z')
  const blocked = await getSearchQuotaSnapshot(db, 'user-pro', 'Pro', now)
  usageCount = 4
  const allowed = await getSearchQuotaSnapshot(db, 'user-pro', 'Pro', now)

  assert.equal(blocked.remaining, 0)
  assert.equal(allowed.remaining, 1)
  assert.equal(capturedWhere.createdAt.gte.toISOString(), '2026-08-02T00:00:00.000Z')
})

test('empty results restore exactly one reserved product search', () => {
  assert.deepEqual(
    getReleasedSearchQuotaSnapshot({ limit: 5, used: 3, remaining: 2, periodKey: '2026-08-02' }),
    { limit: 5, used: 2, remaining: 3, periodKey: '2026-08-02' }
  )
  assert.deepEqual(
    getReleasedSearchQuotaSnapshot({ limit: 1, used: 1, remaining: 0, periodKey: 'lifetime' }),
    { limit: 1, used: 0, remaining: 1, periodKey: 'lifetime' }
  )
})

test('persistent quota reservations are serializable, recover failures and prevent concurrency', () => {
  const quota = fs.readFileSync('lib/searchQuota.ts', 'utf8')
  const route = fs.readFileSync('app/api/search/route.ts', 'utf8')
  const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')

  assert.match(quota, /TransactionIsolationLevel\.Serializable/)
  assert.match(quota, /error\.code === 'P2034'/)
  assert.match(schema, /model SearchUsage/)
  assert.match(schema, /model SearchLock/)
  assert.match(schema, /userId\s+String\s+@unique/)
  assert.match(schema, /cacheKey\s+String\s+@unique/)
  assert.match(route, /if \(reserved\) await releaseSearchQuota/)
  assert.match(route, /if \(lockAcquired\) await releaseSearchLock/)
  assert.match(route, /completeSearchQuota\(prisma, parsed\.requestId, true\)/)
  assert.match(route, /catalog && !enrichmentTriggered/)
})

test('youtube diagnostic is minimal and never prints the API key or keyed URL', () => {
  const diagnostic = fs.readFileSync('scripts/check-youtube-config.mjs', 'utf8')
  const packageJson = fs.readFileSync('package.json', 'utf8')

  assert.match(packageJson, /"youtube:check": "node scripts\/check-youtube-config\.mjs"/)
  assert.match(diagnostic, /youtube\/v3\/videos/)
  assert.match(diagnostic, /fields/)
  assert.doesNotMatch(diagnostic, /console\.(?:log|error)\(apiKey/)
  assert.doesNotMatch(diagnostic, /console\.(?:log|error)\(url/)
})

test('youtube search uses at most three targeted queries and batches only new channel ids', () => {
  const youtubeLib = fs.readFileSync('lib/youtube.ts', 'utf8')

  assert.match(youtubeLib, /buildDiscoveryFallbackQueries/)
  assert.match(youtubeLib, /shouldRunNextYouTubeQuery/)
  assert.match(youtubeLib, /for \(let i = 0; i < newChannelIds\.length; i \+= 50\)/)
  assert.match(youtubeLib, /channelsUrl\.searchParams\.set\('id', batchIds\.join\(','\)\)/)
  assert.match(youtubeLib, /collectNewYouTubeChannelIds/)
  assert.match(youtubeLib, /hiddenSubscriberCount/)
  assert.match(youtubeLib, /fields/)
  assert.doesNotMatch(youtubeLib, /nextPageToken,error/)
  assert.doesNotMatch(youtubeLib, /brandingSettings\/channel\/description\),error/)
  assert.doesNotMatch(youtubeLib, /searchParams\.set\(['"]video/i)
  assert.match(youtubeLib, /youtube\/v3\/videos/)
  assert.match(youtubeLib, /for \(let i = 0; i < allVideoIds\.length; i \+= 50\)/)
})

test('search route uses persistent cache, atomic quotas and cross-instance locks', () => {
  const searchRoute = fs.readFileSync('app/api/search/route.ts', 'utf8')

  assert.match(searchRoute, /prisma\.searchCache\.findFirst/)
  assert.match(searchRoute, /filterYouTubeCatalog\(catalog, parsed\.minVal, parsed\.maxVal/)
  assert.match(searchRoute, /diversifyProspects/)
  assert.match(searchRoute, /acquireSearchLock/)
  assert.match(searchRoute, /reserveSearchQuota/)
  assert.match(searchRoute, /completeSearchQuota/)
  assert.match(searchRoute, /releaseSearchQuota/)
  assert.match(searchRoute, /if \(visibleResults\.length === 0\)/)
  assert.match(searchRoute, /releaseSearchQuota\(prisma, parsed\.requestId\)/)
  assert.match(searchRoute, /completeSearchQuota\(prisma, parsed\.requestId, false\)/)
  assert.match(searchRoute, /searchQueriesUsed/)
  assert.match(searchRoute, /hiddenSubscribers/)
  assert.match(searchRoute, /SEARCH_ALREADY_RUNNING/)
  assert.match(searchRoute, /FREE_SEARCH_USED/)
  assert.match(searchRoute, /PRO_DAILY_SEARCH_LIMIT_REACHED/)
  assert.match(searchRoute, /algorithmVersion: SEARCH_CACHE_VERSION/)
  assert.match(searchRoute, /buildYouTubeErrorResponse/)
})

test('catalog cache is shared globally, locked by niche/language and emits safe aggregate logs', () => {
  const route = fs.readFileSync('app/api/search/route.ts', 'utf8')
  const policy = fs.readFileSync('lib/searchPolicy.ts', 'utf8')
  const youtube = fs.readFileSync('lib/youtube.ts', 'utf8')

  assert.doesNotMatch(policy, /input\.subsMin|input\.subsMax/)
  assert.match(route, /cacheKey,\s*expiresAt/)
  assert.match(route, /SEARCH_CATALOG_POOR_REFRESH_HOURS|shouldEnrichSearchCatalog/)
  assert.match(route, /SEARCH_NEGATIVE_CACHE_TTL_HOURS/)
  assert.doesNotMatch(youtube, /pageToken:/)
  assert.match(youtube, /existingCatalog\?\.variantPerformance/)
  assert.match(route, /catalogHit:/)
  assert.match(route, /channelCatalogCandidates:/)
  assert.match(route, /strictSubnicheMatches:/)
  assert.match(route, /searchListCalls:/)
  const eventStart = route.indexOf("console.info('YouTube catalog event:'")
  const eventBody = route.slice(eventStart, route.indexOf('\n  })', eventStart) + 5)
  assert.doesNotMatch(eventBody, /userIdHash|email|YOUTUBE_API_KEY|googleapis|query:/)
})

test('dashboard handles youtube 429 without double submission or raw Google errors', () => {
  const dashboard = fs.readFileSync('app/dashboard/page.tsx', 'utf8')

  assert.match(dashboard, /if \(loading\) return/)
  assert.match(dashboard, /searchPausedUntil/)
  assert.match(dashboard, /res\.status === 429/)
  assert.match(dashboard, /disabled=\{loading \|\| Date\.now\(\) < searchPausedUntil\}/)
  assert.match(dashboard, /data\.message \|\| data\.error/)
  assert.doesNotMatch(dashboard, /Quota exceeded for quota metric/)
  assert.match(dashboard, /crypto\.randomUUID\(\)/)
  assert.match(dashboard, /fetch\('\/api\/search'\)/)
  assert.match(dashboard, /quotaMessage/)
  assert.match(dashboard, /searchFeedback/)
  assert.match(dashboard, /FREE_LIFETIME_SEARCH_LIMIT/)
  assert.match(dashboard, /PRO_DAILY_SEARCH_LIMIT/)
})

test('prospect score explanation is transparent and avoids misleading promises', () => {
  const component = fs.readFileSync('components/ProspectScoreExplanation.tsx', 'utf8')
  const combinedText = [
    PROSPECT_SCORE_EXPLANATION,
    PROSPECT_SCORE_TRANSPARENCY_NOTE,
    ...PROSPECT_SCORE_SIGNALS,
    ...PROSPECT_SCORE_LEVELS.map(level => `${level.label} ${level.description}`),
  ].join(' ')

  assert.match(component, /Comment est calcule le score/)
  assert.match(combinedText, /potentiel commercial/)
  assert.match(combinedText, /signaux publics/)
  assert.match(combinedText, /pas un besoin confirme/)
  assert.doesNotMatch(combinedText, /cherche activement un monteur/i)
  assert.doesNotMatch(combinedText, /va repondre|deviendra client|garantit une opportunite/i)
})

test('prospect score levels match the current advanced score thresholds', () => {
  assert.equal(PROSPECT_SCORE_THRESHOLDS.exceptional, 90)
  assert.equal(PROSPECT_SCORE_THRESHOLDS.excellent, 80)
  assert.equal(PROSPECT_SCORE_THRESHOLDS.good, 65)
  assert.equal(PROSPECT_SCORE_THRESHOLDS.medium, 50)
  assert.deepEqual(
    PROSPECT_SCORE_LEVELS.map(level => [level.label, level.min, level.max]),
    [
      ['Prospect exceptionnel', 90, 100],
      ['Excellent', 80, 89],
      ['Bon', 65, 79],
      ['Moyen', 50, 64],
      ['Faible', 0, 49],
    ]
  )
})

test('prospect score explanation is accessible and reused across score surfaces', () => {
  const component = fs.readFileSync('components/ProspectScoreExplanation.tsx', 'utf8')
  const dashboard = fs.readFileSync('app/dashboard/page.tsx', 'utf8')
  const favorites = fs.readFileSync('app/favorites/page.tsx', 'utf8')
  const history = fs.readFileSync('app/history/page.tsx', 'utf8')
  const campaigns = fs.readFileSync('app/campaigns/page.tsx', 'utf8')
  const presentation = fs.readFileSync('components/ProspectPresentation.tsx', 'utf8')
  const creatorDetails = fs.readFileSync('components/CreatorDetails.tsx', 'utf8')

  assert.match(component, /role="dialog"/)
  assert.match(component, /aria-modal="true"/)
  assert.match(component, /aria-label="Comprendre le calcul du Prospect Score"/)
  assert.match(component, /event\.key === 'Escape'/)
  for (const source of [dashboard, favorites, history, campaigns, presentation, creatorDetails]) {
    assert.match(source, /ProspectScoreExplanation/)
  }
})

test('prospect score uses recent content and contactability stays separate', () => {
  const target = { niche: 'Gaming', subNiches: ['Minecraft'], customKeyword: '', language: 'Français' }
  const videos = Array.from({ length: 5 }, (_, index) => ({ title: `Minecraft survie episode ${index}`, description: 'Une vidéo en français avec des astuces pour jouer', viewCount: index === 4 ? 1000000 : 20000, likeCount: 1000, commentCount: 100, publishedAt: new Date(Date.now() - index * 604800000).toISOString(), defaultLanguage: 'fr' }))
  assert.equal(calculateMedian([1, 2, 100]), 2)
  assert.equal(calculateTrimmedMean([1, 2, 3, 4, 100], .2), 3)
  assert.ok(scoreChannelContentRelevance(videos, target).score >= 80)
  assert.equal(detectDominantContentLanguage(videos).language, 'fr')
  const withoutContact = calculateProspectScore({ videos, target, subscribers: 40000 })
  const withContact = calculateProspectScore({ videos, target, subscribers: 40000 })
  assert.equal(withoutContact.score, withContact.score)
  assert.equal(getContactability({}).level, 'Faible')
  assert.equal(getContactability({ email: 'x@example.com', instagram: 'https://instagram.com/x' }).level, 'Élevée')
})

test('prospect score strongly prioritizes recent commercial performance', () => {
  const target = { niche: 'Gaming', subNiches: ['Fortnite'], customKeyword: '', language: 'Français' }
  const videos = (viewCount) => Array.from({ length: 6 }, (_, index) => ({
    title: `Fortnite gameplay astuces ${index}`,
    description: 'Gameplay Fortnite en francais avec montage et best of',
    viewCount,
    durationSeconds: 900,
    publishedAt: new Date(Date.now() - index * 7 * 86400000).toISOString(),
    defaultLanguage: 'fr',
  }))
  const strong = calculateProspectScore({ videos: videos(9800), target, subscribers: 26000 })
  const weak = calculateProspectScore({ videos: videos(500), target, subscribers: 15000 })
  assert.ok(strong.score >= weak.score + 20)
  assert.equal(strong.scoreBreakdown.recentViews, 16)
  assert.equal(strong.scoreBreakdown.growthPotential, 15)
  assert.equal(weak.scoreBreakdown.recentViews, 4)
  assert.equal(weak.scoreBreakdown.growthPotential, 3)
  assert.deepEqual(Object.keys(strong.scoreBreakdown), ['recentViews', 'growthPotential', 'publishingRhythm', 'recentActivity', 'editingNeed', 'targeting'])
})

test('targeting validates niches, sub-niches and bounded custom keywords', () => {
  assert.ok(Object.keys(NICHE_CONFIG).length >= 20)
  const target = validateSearchTarget({ niche: 'Gaming', lang: 'Français', subNiches: ['Minecraft', 'Speedrun'], customKeyword: 'survie' })
  assert.deepEqual(target.subNiches, ['Minecraft', 'Speedrun'])
  assert.match(buildTargetQuery(target), /Gaming Minecraft Speedrun survie/)
  assert.equal(validateSearchTarget({ niche: 'Gaming', lang: 'Klingon', subNiches: [] }), null)
  assert.equal(validateSearchTarget({ niche: 'Gaming', lang: 'Français', subNiches: ['Invalide'] }), null)
})

test('content relevance ignores channel naming and validates the observed video topic', () => {
  const vocabulary = ['gaming', 'minecraft']
  assert.ok(scoreVideoTopicMatch({ title: 'Survie Minecraft épisode 10', description: 'gaming en français' }, vocabulary) >= 50)
  assert.equal(scoreVideoTopicMatch({ title: 'Prière du dimanche', description: 'enseignement religieux' }, vocabulary), 0)
  const relevant = scoreChannelContentRelevance(Array.from({ length: 8 }, (_, i) => ({ title: `Minecraft aventure ${i}` })), { niche: 'Gaming', subNiches: ['Minecraft'], customKeyword: '', language: 'Français' })
  assert.ok(relevant.score >= 80)
})

test('dominant language rejects confident Portuguese content for a French target', () => {
  const portuguese = Array.from({ length: 6 }, (_, i) => ({ title: `Como jogar melhor ${i}`, description: 'uma video com voce para aprender que nao pode perder', defaultLanguage: 'pt' }))
  const language = detectDominantContentLanguage(portuguese)
  assert.equal(language.language, 'pt')
  assert.equal(language.confidence, 'Élevée')
})

test('catalog V8 is targeted by subniche but shared across local subscriber bounds', () => {
  const base = buildSearchCacheKey({ niche: 'Gaming', lang: 'Français', subNiches: ['Minecraft'], customKeyword: '' })
  const reordered = buildSearchCacheKey({ niche: 'Gaming', lang: 'Français', subNiches: ['Minecraft'], customKeyword: '' })
  const otherSubNiche = buildSearchCacheKey({ niche: 'Gaming', lang: 'Français', subNiches: ['Speedrun'], customKeyword: '' })
  assert.equal(base, reordered)
  assert.notEqual(base, otherSubNiche)
  assert.doesNotMatch(base, /10000|50000/)
})

test('advanced filters are fully removed from client and server', () => {
  const route = fs.readFileSync('app/api/search/route.ts', 'utf8')
  const dashboard = fs.readFileSync('app/dashboard/page.tsx', 'utf8')
  for (const removed of ['emailOnly', 'activeOnly', 'minMedianViews', 'minContentRelevance', 'Filtres avancés']) {
    assert.doesNotMatch(`${route}\n${dashboard}`, new RegExp(removed))
  }
})

test('free campaign discovery is limited and durable without enabling campaign AI', () => {
  assert.equal(FREE_LIFETIME_CAMPAIGN_LIMIT, 1)
  assert.equal(FREE_CAMPAIGN_PROSPECT_LIMIT, 5)
  assert.equal(FREE_CAMPAIGN_MARKER_PERIOD, 'free-campaign')
  assert.equal(FREE_CAMPAIGN_COMPLETED_PERIOD, 'free-campaign-completed')
  const campaignRoute = fs.readFileSync('app/api/campaigns/route.ts', 'utf8')
  const prospectRoute = fs.readFileSync('app/api/campaigns/[id]/prospects/route.ts', 'utf8')
  const generateRoute = fs.readFileSync('app/api/campaigns/[id]/generate/route.ts', 'utf8')
  const sendRoute = fs.readFileSync('app/api/campaigns/[id]/send/route.ts', 'utf8')
  const dashboard = fs.readFileSync('app/dashboard/page.tsx', 'utf8')
  assert.match(campaignRoute, /hasUsedFreeCampaign/)
  assert.match(campaignRoute, /markFreeCampaignUsed/)
  assert.match(prospectRoute, /FREE_CAMPAIGN_PROSPECT_LIMIT/)
  assert.match(generateRoute, /requireProResponse/)
  assert.match(sendRoute, /markFreeCampaignCompleted/)
  assert.doesNotMatch(dashboard.match(/const addToCampaign[\s\S]*?const toggleSelected/)?.[0] || '', /setUpgradeOpen/)
})

test('subniche filtering relaxes only topic qualification when strict matches are empty', () => {
  const target = { niche: 'Gaming', subNiches: ['Fortnite'], customKeyword: '', language: 'Français' }
  const nearby = filterYouTubeCatalog({ channels: [{ id: 'near', subsNum: 20000, score: 40, recentVideos: [{ title: 'Actualite gaming generale' }] }] }, 10000, 100000, 20, target)
  assert.equal(nearby.length, 1)
  assert.equal(nearby[0].matchMode, 'nearby')
  assert.deepEqual(filterYouTubeCatalog({ channels: [{ id: 'outside', subsNum: 200000, recentVideos: [{ title: 'Fortnite francais' }] }] }, 10000, 100000, 20, target), [])
})

test('Mode homme uses three targeted queries without a generic Mode query', () => {
  const target = { niche: 'Mode', subNiches: ['Mode homme'], customKeyword: '', language: 'Français' }
  const queries = buildYouTubeQueryVariants(getPrimarySearchFocus(target), target.language, getSearchFocusVariants(target))
  assert.deepEqual(queries, ['Mode homme français', 'style masculin français', 'conseils vetements homme français'])
  assert.equal(queries.some(query => query.toLowerCase() === 'mode français'), false)
})

test('rotation prioritizes unseen strict prospects without promoting weak nearby results', () => {
  const channels = [
    { id: 'best', score: 100, contentRelevance: 100, subnicheMatch: 100 },
    { id: 'new', score: 70, contentRelevance: 70, subnicheMatch: 70 },
    { id: 'weak', score: 20, contentRelevance: 20, subnicheMatch: 10, matchMode: 'nearby' },
  ]
  const common = { channels, campaignChannelIds: new Set(), globalExposure: new Map(), userSeed: 'hashed-internally', targetKey: 'gaming:fortnite', now: new Date('2026-08-05T10:00:00Z'), limit: 3 }
  const result = diversifyProspects({ ...common, seenChannelIds: new Set(['best']) })
  assert.deepEqual(result.results.map(item => item.id), ['new', 'best', 'weak'])
  assert.equal(result.newCount, 2)
  assert.equal(result.seenCount, 1)
})

test('search results prioritize strict matches and descending prospect quality', () => {
  const ranked = sortProspectsByQuality([
    { id: 'near-95', matchMode: 'nearby', score: 95, editingPotential: 90, subnicheMatch: 90 },
    { id: 'strict-76', score: 76, editingPotential: 90, subnicheMatch: 90, previouslySeen: false },
    { id: 'strict-91', score: 91, editingPotential: 20, subnicheMatch: 20, previouslySeen: true },
    { id: 'strict-82-low-edit', score: 82, editingPotential: 30, subnicheMatch: 90 },
    { id: 'strict-82-high-edit', score: 82, editingPotential: 80, subnicheMatch: 20 },
  ])
  assert.deepEqual(ranked.map(item => item.id), [
    'strict-91',
    'strict-82-high-edit',
    'strict-82-low-edit',
    'strict-76',
    'near-95',
  ])
})

test('diversification only breaks ties after quality and user novelty', () => {
  const ranked = sortProspectsByQuality([
    { id: 'seen', score: 80, editingPotential: 50, subnicheMatch: 50, previouslySeen: true, diversificationRank: 100 },
    { id: 'new-low-rank', score: 80, editingPotential: 50, subnicheMatch: 50, previouslySeen: false, diversificationRank: 1 },
    { id: 'new-high-rank', score: 80, editingPotential: 50, subnicheMatch: 50, previouslySeen: false, diversificationRank: 2 },
  ])
  assert.deepEqual(ranked.map(item => item.id), ['new-high-rank', 'new-low-rank', 'seen'])
})

test('user target keys are stable, normalized and contain no raw target data', () => {
  const first = buildUserTargetKey({ niche: ' Gaming ', subNiches: ['Fortnite'], customKeyword: ' Battle Royale ', language: 'Français' }, 10000, 100000)
  const second = buildUserTargetKey({ niche: 'gaming', subNiches: [' fortnite '], customKeyword: 'battle royale', language: 'francais' }, 10000, 100000)
  assert.equal(first, second)
  assert.match(first, /^[a-f0-9]{20}$/)
  assert.doesNotMatch(first, /gaming|fortnite|francais/)
  assert.notEqual(first, buildUserTargetKey({ niche: 'Gaming', subNiches: ['Fortnite'], customKeyword: '', language: 'Français' }, 50000, 100000))
})

test('target exposure includes only results actually returned for the same target', () => {
  const targetKey = 'target-a'
  const rows = [
    { results: JSON.stringify(markSearchResultsForTarget([{ id: 'recent-a' }, { id: 'recent-b' }], targetKey)) },
    { results: JSON.stringify(markSearchResultsForTarget([{ id: 'older' }], targetKey)) },
    { results: JSON.stringify(markSearchResultsForTarget([{ id: 'other-target' }], 'target-b')) },
    { results: JSON.stringify([{ id: 'catalog-only-without-marker' }]) },
  ]
  const exposure = getUserTargetExposure(rows, targetKey)
  assert.deepEqual([...exposure.seenChannelIds].sort(), ['older', 'recent-a', 'recent-b'])
  assert.deepEqual([...exposure.previousSearchChannelIds].sort(), ['recent-a', 'recent-b'])
})

test('repeated searches rotate through unseen batches then recycle quality results', () => {
  const channels = Array.from({ length: 45 }, (_, index) => ({
    id: `c${String(index).padStart(2, '0')}`,
    score: 100 - index,
    editingPotential: 80 - index,
    subnicheMatch: 70 - index,
  }))
  const common = { channels, campaignChannelIds: new Set(), globalExposure: new Map(), userSeed: 'user-a', targetKey: 'target', now: new Date('2026-08-05'), limit: 20 }
  const first = diversifyProspects({ ...common, seenChannelIds: new Set() })
  const firstIds = new Set(first.results.map(item => item.id))
  const second = diversifyProspects({ ...common, seenChannelIds: firstIds, previousSearchChannelIds: firstIds })
  const firstTwoIds = new Set([...firstIds, ...second.results.map(item => item.id)])
  const third = diversifyProspects({ ...common, seenChannelIds: firstTwoIds, previousSearchChannelIds: new Set(second.results.map(item => item.id)) })

  assert.deepEqual(first.results.map(item => item.id), channels.slice(0, 20).map(item => item.id))
  assert.equal(second.results.some(item => firstIds.has(item.id)), false)
  assert.deepEqual(second.results.map(item => item.id), channels.slice(20, 40).map(item => item.id))
  assert.deepEqual(third.results.slice(0, 5).map(item => item.id), channels.slice(40, 45).map(item => item.id))
  assert.equal(third.newCount, 5)
  assert.equal(third.seenCount, 15)

  const exhausted = diversifyProspects({ ...common, seenChannelIds: new Set(channels.map(item => item.id)) })
  assert.equal(exhausted.results.length, 20)
  assert.deepEqual(exhausted.results.map(item => item.id), channels.slice(0, 20).map(item => item.id))
})

test('rotation keeps strict groups before nearby groups at the same exposure level', () => {
  const ranked = sortProspectsForRotation([
    { id: 'seen-strict', score: 99, previouslySeen: true },
    { id: 'new-nearby', score: 95, matchMode: 'nearby' },
    { id: 'new-strict-low', score: 70 },
    { id: 'new-strict-high', score: 90 },
    { id: 'seen-nearby', score: 100, matchMode: 'nearby', previouslySeen: true },
  ])
  assert.deepEqual(ranked.map(item => item.id), ['new-strict-high', 'new-strict-low', 'new-nearby', 'seen-strict', 'seen-nearby'])
})

test('campaign prospects are strongly deferred without becoming globally unavailable', () => {
  const channels = Array.from({ length: 21 }, (_, index) => ({ id: `c${index}`, score: 100 - index, editingPotential: 50, subnicheMatch: 50 }))
  const common = { channels, seenChannelIds: new Set(), globalExposure: new Map(), targetKey: 'target', now: new Date('2026-08-05'), limit: 20 }
  const userA = diversifyProspects({ ...common, userSeed: 'user-a', campaignChannelIds: new Set(['c0']) })
  const userB = diversifyProspects({ ...common, userSeed: 'user-b', campaignChannelIds: new Set() })
  assert.equal(userA.results.some(item => item.id === 'c0'), false)
  assert.equal(userB.results[0].id, 'c0')
})

test('search route persists and returns only the twenty selected rotation results', () => {
  const route = fs.readFileSync('app/api/search/route.ts', 'utf8')
  assert.match(route, /getUserTargetExposure\(userSearches, userTargetKey\)/)
  assert.match(route, /limit: Math\.min\(20, channels\.length\)/)
  assert.match(route, /JSON\.stringify\(markSearchResultsForTarget\(input\.results, input\.targetKey\)\)/)
  assert.equal((route.match(/return NextResponse\.json\(\{\s*results: visibleResults,\s*resultMeta:/g) || []).length, 2)
})

test('dashboard exposes simple result counts and paginates twenty then ten', () => {
  const dashboard = fs.readFileSync('app/dashboard/page.tsx', 'utf8')
  for (const internalLabel of ['vidéos ciblées', 'chaînes uniques', 'Catalogue enrichi', 'Résultats instantanés (cache)']) {
    assert.doesNotMatch(dashboard, new RegExp(internalLabel))
  }
  assert.match(dashboard, /useState\(20\)/)
  assert.match(dashboard, /results\.slice\(0, visibleResults\)/)
  assert.match(dashboard, /setVisibleResults\(value => value \+ 10\)/)
  assert.match(dashboard, /créateur.*correspond.*votre recherche/)
  assert.doesNotMatch(dashboard, /results\.slice\(0, 5\)/)
})

test('diversification is deterministic per user/day and changes softly across users', () => {
  const channels = Array.from({ length: 8 }, (_, index) => ({ id: `c${index}`, score: 70, contentRelevance: 70, subnicheMatch: 70 }))
  const base = { channels, seenChannelIds: new Set(), campaignChannelIds: new Set(), globalExposure: new Map(), targetKey: 'mode:homme', now: new Date('2026-08-05T10:00:00Z'), limit: 8 }
  const first = diversifyProspects({ ...base, userSeed: 'user-a' }).results.map(item => item.id)
  const repeated = diversifyProspects({ ...base, userSeed: 'user-a' }).results.map(item => item.id)
  const otherUser = diversifyProspects({ ...base, userSeed: 'user-b' }).results.map(item => item.id)
  assert.deepEqual(first, repeated)
  assert.notDeepEqual(first, otherUser)
})

test('history exposure parsing is safe and campaign prospects receive a stronger penalty', () => {
  const rows = [{ results: JSON.stringify([{ id: 'seen' }, { channelId: 'other' }]) }, { results: 'invalid-json' }]
  assert.deepEqual([...extractChannelIdsFromSearchResults(rows)].sort(), ['other', 'seen'])
  assert.equal(countGlobalChannelExposure([rows[0], rows[0]]).get('seen'), 2)
  const targetKey = buildExposureTargetKey({ niche: 'Gaming', subNiches: ['Fortnite'], customKeyword: '', language: 'Français' }, 10000, 100000)
  assert.doesNotMatch(targetKey, /user|email/i)
  const ranked = diversifyProspects({
    channels: [{ id: 'campaign', score: 80, contentRelevance: 80, subnicheMatch: 80 }, { id: 'fresh', score: 80, contentRelevance: 80, subnicheMatch: 80 }],
    seenChannelIds: new Set(), campaignChannelIds: new Set(['campaign']), globalExposure: new Map(), userSeed: 'user', targetKey, now: new Date('2026-08-05'), limit: 2,
  })
  assert.equal(ranked.results[0].id, 'fresh')
})

test('prospect score confidence follows the observed video sample size', () => {
  const target = { niche: 'Gaming', subNiches: ['Fortnite'], customKeyword: '', language: 'Français' }
  const video = { title: 'Fortnite gameplay français', publishedAt: new Date().toISOString(), viewCount: 5000, durationSeconds: 600 }
  assert.equal(calculateProspectScore({ videos: [video], target, subscribers: 20000 }).confidence, 'Faible')
  assert.equal(calculateProspectScore({ videos: Array.from({ length: 3 }, () => video), target, subscribers: 20000 }).confidence, 'Moyenne')
  assert.equal(calculateProspectScore({ videos: Array.from({ length: 8 }, () => video), target, subscribers: 20000 }).confidence, 'Elevee')
})

test('adaptive fallback hierarchy is strict, format then a distinct broad query', () => {
  const fortnite = buildDiscoveryFallbackQueries({ niche: 'Gaming', subNiches: ['Fortnite'], customKeyword: '', language: 'Français' })
  assert.deepEqual(fortnite.slice(0, 3).map(item => item.level), ['strict', 'format', 'fallback'])
  assert.equal(fortnite[0].query, 'fortnite français')
  assert.equal(fortnite[1].query, 'fortnite gameplay astuces français')
  assert.equal(fortnite[2].query, 'fortnite actualite challenge français')
  assert.equal(new Set(fortnite.map(item => item.query)).size, fortnite.length)
  assert.equal(classifyQueryBreadth('unknown'), 'strict')
})

test('variant yield rewards strict matches and penalizes duplicate-heavy results', () => {
  const efficient = calculateQueryVariantYield({ strictMatches: 10, nearbyMatches: 4, uniqueChannels: 30, duplicateVideos: 5, rawVideos: 35 })
  const duplicateHeavy = calculateQueryVariantYield({ strictMatches: 10, nearbyMatches: 4, uniqueChannels: 10, duplicateVideos: 40, rawVideos: 50 })
  assert.ok(efficient > duplicateHeavy)
})

test('variant ranking prefers known yield while preserving complementary exploration', () => {
  const variants = buildDiscoveryFallbackQueries({ niche: 'Gaming', subNiches: ['Fortnite'], customKeyword: '', language: 'Français' })
  const performance = {
    [variants[1].id]: { variantId: variants[1].id, level: 'format', rawVideos: 50, uniqueChannels: 35, channelsAfterLanguage: 25, channelsAfterSubscribers: 20, strictMatches: 15, nearbyMatches: 5, duplicateVideos: 15, lastUsedAt: '2026-08-05', uses: 1, yield: 20 },
    [variants[0].id]: { variantId: variants[0].id, level: 'strict', rawVideos: 50, uniqueChannels: 5, channelsAfterLanguage: 3, channelsAfterSubscribers: 3, strictMatches: 1, nearbyMatches: 2, duplicateVideos: 45, lastUsedAt: '2026-08-05', uses: 1, yield: 1 },
  }
  assert.equal(rankQueryVariants(variants, performance)[0].id, variants[1].id)
  const selected = [variants[1]]
  assert.notEqual(selectComplementaryVariant(rankQueryVariants(variants, performance), selected)?.level, 'format')
  assert.equal(selectNextDiscoveryVariant(variants, [], performance)?.id, variants[1].id)
})

test('variant performance updates are cumulative and deterministic', () => {
  const current = { variantId: 'safe-hash', level: 'strict', rawVideos: 50, uniqueChannels: 30, channelsAfterLanguage: 20, channelsAfterSubscribers: 15, strictMatches: 12, nearbyMatches: 3, duplicateVideos: 20, lastUsedAt: '2026-08-05' }
  const first = updateVariantPerformance(undefined, current)
  const second = updateVariantPerformance(first, current)
  assert.equal(second.uses, 2)
  assert.equal(second.rawVideos, 100)
  assert.equal(second.strictMatches, 24)
  assert.equal(second.yield, calculateQueryVariantYield(second))
})

test('catalog coverage distinguishes known, shown and user-new channels', () => {
  const channels = [{ id: 'a' }, { id: 'b', matchMode: 'nearby' }, { id: 'c' }]
  const coverage = calculateCatalogCoverage({ channels, matchedChannels: channels, globalExposure: new Map([['a', 2]]), newlyDiscoveredThisRun: 2, alreadyKnownThisRun: 1, rawVideoResults: 6, duplicateVideoResults: 3, now: new Date('2026-08-05') })
  assert.equal(coverage.totalChannelsKnown, 3)
  assert.equal(coverage.channelsShownAtLeastOnce, 1)
  assert.equal(coverage.channelsNeverShown, 2)
  assert.equal(coverage.coverageRate, 0.333)
  assert.equal(coverage.duplicateVideoResults, 3)
  assert.deepEqual(getUserCoverage(channels, new Set(['a', 'b'])), { newForUser: 1, alreadySeenByUser: 2, catalogRemainingForUser: 1 })
})

test('high coverage or few new prospects enrich only after the twelve-hour delay', () => {
  const recent = { candidateCount: 30, filteredResultCount: 20, newForUser: 2, coverageRate: 0.9, collectedAt: '2026-08-05T08:00:00Z', now: new Date('2026-08-05T10:00:00Z') }
  assert.equal(shouldEnrichSearchCatalog(recent), false)
  assert.equal(shouldEnrichSearchCatalog({ ...recent, collectedAt: '2026-08-04T20:00:00Z' }), true)
})

test('variant and coverage diagnostics contain hashes and aggregates, never raw targets', () => {
  const route = fs.readFileSync('app/api/search/route.ts', 'utf8')
  const youtube = fs.readFileSync('lib/youtube.ts', 'utf8')
  assert.match(route, /queryVariantIds/)
  assert.match(route, /catalogCoverageRate/)
  assert.doesNotMatch(route.slice(route.indexOf('function getCatalogLogDetails'), route.indexOf('function parseSearchBody')), /\.query|userId|email|title/)
  assert.doesNotMatch(youtube, /console\.(?:info|log)\([^\n]*(?:variant\.query|queryVariantsUsed)/)
})

test('registration validates and normalizes valid accounts for immediate credentials login', () => {
  const result = validateRegistrationInput({ name: ' Valentin ', email: ' USER@Example.COM ', password: 'secret12' })
  assert.equal(result.ok, true)
  assert.deepEqual(result.data, { name: 'Valentin', email: 'user@example.com', password: 'secret12' })
  assert.equal(normalizeAccountEmail(' USER@Example.COM '), 'user@example.com')

  const route = fs.readFileSync('app/api/register/route.ts', 'utf8')
  const auth = fs.readFileSync('lib/auth.ts', 'utf8')
  const page = fs.readFileSync('app/register/page.tsx', 'utf8')
  assert.match(route, /plan: 'Gratuit'/)
  assert.match(route, /searchesRemaining: FREE_LIFETIME_SEARCH_LIMIT/)
  assert.match(route, /bcrypt\.hash\(password, 10\)/)
  assert.match(auth, /normalizeAccountEmail\(credentials\.email\)/)
  assert.match(auth, /bcrypt\.compare\(credentials\.password, user\.password\)/)
  assert.match(page, /submittingRef\.current/)
  assert.match(page, /disabled=\{loading\}/)
  assert.match(page, /if \(login\?\.error\)/)
  assert.match(page, /router\.push\('\/dashboard\/home'\)/)
})

test('registration rejects missing or malformed required fields', () => {
  assert.equal(validateRegistrationInput(null).ok, false)
  assert.equal(validateRegistrationInput({ name: '', email: 'x@example.com', password: 'secret12' }).ok, false)
  assert.equal(validateRegistrationInput({ name: 'X', email: 'invalid', password: 'secret12' }).ok, false)
  assert.equal(validateRegistrationInput({ name: 'X', email: 'x@example.com', password: 'short' }).ok, false)
})

test('registration classifies duplicate, schema and unavailable Prisma failures safely', () => {
  const duplicate = classifyRegistrationError({ name: 'PrismaClientKnownRequestError', code: 'P2002', meta: { modelName: 'User', target: ['email'] } })
  assert.equal(duplicate.code, 'REGISTRATION_EMAIL_ALREADY_EXISTS')
  assert.equal(duplicate.status, 409)
  assert.deepEqual(duplicate.safeMeta, { model: 'User', fields: ['email'] })

  for (const code of ['P2021', 'P2022']) {
    const schema = classifyRegistrationError({ name: 'PrismaClientKnownRequestError', code, meta: { table: 'public.User', column: 'public.searchesRemaining' } })
    assert.equal(schema.code, 'REGISTRATION_DATABASE_SCHEMA_ERROR')
    assert.equal(schema.status, 503)
  }
  for (const code of ['P1000', 'P1001', 'P1002', 'P1008', 'P1017']) {
    const unavailable = classifyRegistrationError({ name: 'PrismaClientInitializationError', errorCode: code })
    assert.equal(unavailable.code, 'REGISTRATION_DATABASE_UNAVAILABLE')
    assert.equal(unavailable.status, 503)
  }
})

test('registration diagnostics never expose raw messages or sensitive metadata', () => {
  const raw = {
    name: 'PrismaClientKnownRequestError',
    code: 'P2022',
    message: 'password=user@example.com DATABASE_URL=postgresql://secret',
    stack: 'token and hash',
    meta: { modelName: 'User', column: 'public.password', email: 'user@example.com', database_url: 'postgresql://secret' },
  }
  const classified = classifyRegistrationError(raw)
  const serialized = JSON.stringify(classified)
  assert.deepEqual(getSafePrismaMeta(raw), { model: 'User', column: 'password' })
  assert.doesNotMatch(serialized, /user@example\.com|postgresql:\/\/|token and hash/)

  const route = fs.readFileSync('app/api/register/route.ts', 'utf8')
  assert.match(route, /event: 'registration_failed'/)
  assert.doesNotMatch(route, /console\.error\([^)]*(email|password|hashed|DATABASE_URL)/s)
})

test('standard Pro pricing has no launch offer route, coupon or discount wiring', () => {
  const checkoutRoute = fs.readFileSync('app/api/stripe/checkout/route.ts', 'utf8')
  const stripeHelper = fs.readFileSync('lib/stripeConfig.ts', 'utf8')
  const sources = [
    'app/LandingPage.tsx',
    'app/dashboard/page.tsx',
    'components/ProGate.tsx',
    'components/SubscriptionButton.tsx',
    'app/api/stripe/checkout/route.ts',
    'lib/stripeConfig.ts',
    '.env.example',
  ].map(file => fs.readFileSync(file, 'utf8')).join('\n')

  assert.equal(fs.existsSync('app/api/launch-offer/route.ts'), false)
  assert.match(checkoutRoute, /getValidatedStripeConfig/)
  assert.match(stripeHelper, /STRIPE_PRICE_PRO/)
  assert.match(sources, /4,90/)
  assert.doesNotMatch(checkoutRoute, /discounts/)
  assert.doesNotMatch(checkoutRoute, /allow_promotion_codes/)
  assert.doesNotMatch(checkoutRoute, /promotion_code|coupon/)
  assert.doesNotMatch(sources, /STRIPE_LAUNCH_PROMOTION_ID/)
  assert.doesNotMatch(sources, /4,95|4\.95|9,90|9\.90/)
  assert.doesNotMatch(sources, /offre de lancement|Offre de lancement|5 places/)
})

test('free Gmail access lasts until the trial campaign succeeds while Pro stays allowed', () => {
  assert.equal(isGmailIntegrationAllowed('Gratuit', false), true)
  assert.equal(isGmailIntegrationAllowed('Gratuit', true), false)
  assert.equal(isGmailIntegrationAllowed(' Pro ', true), true)

  const connectRoute = fs.readFileSync('app/api/gmail/connect/route.ts', 'utf8')
  const callbackRoute = fs.readFileSync('app/api/gmail/callback/route.ts', 'utf8')
  const sendRoute = fs.readFileSync('app/api/campaigns/[id]/send/route.ts', 'utf8')
  assert.match(connectRoute, /canUseGmailIntegration/)
  assert.match(callbackRoute, /canUseGmailIntegration/)
  assert.match(sendRoute, /hasCompletedFreeCampaign/)
  assert.match(sendRoute, /results\.some\(result => result\.success\)/)
  assert.match(sendRoute, /markFreeCampaignCompleted/)
})

test('Gmail OAuth uses the minimal compose scope and classifies safe failures', () => {
  const connectRoute = fs.readFileSync('app/api/gmail/connect/route.ts', 'utf8')
  assert.equal(REQUIRED_GMAIL_DRAFT_SCOPE, 'https://www.googleapis.com/auth/gmail.compose')
  assert.doesNotMatch(connectRoute, /https:\/\/mail\.google\.com|gmail\.modify|gmail\.readonly/)
  assert.equal(classifyGoogleOAuthError('access_denied'), 'OAUTH_ACCESS_DENIED')
  assert.equal(classifyGoogleOAuthError('redirect_uri_mismatch'), 'OAUTH_REDIRECT_MISMATCH')
  assert.equal(classifyGoogleOAuthError('app not verified'), 'OAUTH_APP_UNVERIFIED')
  assert.equal(classifyGoogleOAuthError('test_user_not_allowed'), 'OAUTH_ACCOUNT_NOT_ALLOWED')
  assert.match(getSafeGmailOAuthMessage('OAUTH_APP_UNVERIFIED'), /pas encore disponible/)
})

test('Gmail OAuth diagnostics and replay handling do not leak secrets', () => {
  const calls = []
  const previous = console.error
  console.error = value => calls.push(value)
  try {
    logSafeGmailOAuthFailure({ code: 'GMAIL_INTERNAL_ERROR', step: 'callback', error: new Error('token=secret@example.com') })
  } finally {
    console.error = previous
  }
  const serialized = JSON.stringify(calls)
  assert.match(serialized, /gmail_oauth_failed/)
  assert.doesNotMatch(serialized, /secret@example\.com|token=/)
  assert.equal(isConnectedOAuthReplay('invalid_grant', 'refresh-token-present'), true)
  assert.equal(isConnectedOAuthReplay('invalid_grant', null), false)
  assert.equal(isConnectedOAuthReplay('access_denied', 'refresh-token-present'), false)
})

test('public email extraction supports direct and safely obfuscated channel emails', () => {
  const cases = [
    'Business: hello@creator.fr',
    'Contact : hello @ creator.fr',
    'Contact : hello[at]creator[dot]fr',
    'Contact : hello (at) creator (dot) fr',
    'Contact : hello arobase creator point fr',
  ]
  for (const text of cases) {
    const best = selectBestPublicEmail(extractPublicEmails(text))
    assert.equal(best?.email, 'hello@creator.fr')
    assert.equal(best?.source, 'channel_description')
  }
  assert.match(normalizeObfuscatedEmail('hello [at] creator [dot] fr'), /hello@creator\.fr/)
})

test('public email ranking favors commercial bios and repeated recent video contacts', () => {
  const candidates = extractPublicEmails([
    { text: 'Pour toute collaboration business : creator@studio.fr', source: 'channel_description' },
    { text: 'Contact vidéo creator@studio.fr', source: 'video_description', publishedAt: new Date().toISOString() },
    { text: 'Sponsor de la vidéo : deals@brand.fr', source: 'video_description', publishedAt: new Date().toISOString() },
  ])
  const ranked = rankPublicEmailCandidates(candidates)
  assert.equal(ranked[0].email, 'creator@studio.fr')
  assert.equal(ranked[0].confidence, 'high')
  assert.equal(ranked[0].occurrences, 2)
  assert.equal(selectBestPublicEmail(candidates)?.email, 'creator@studio.fr')
  assert.equal(candidates.find(candidate => candidate.email === 'deals@brand.fr')?.confidence, 'low')
})

test('public email extraction rejects placeholders, noreply and image filenames', () => {
  const candidates = extractPublicEmails('example@example.com test@test.com name@domain.com noreply@creator.fr fichier@2x.png real@creator.fr')
  assert.deepEqual(candidates.map(candidate => candidate.email), ['real@creator.fr'])
  assert.equal(redactEmailForLogs('real@creator.fr'), 'r***@c***')
})

test('public email extraction is deduplicated and does not affect Prospect Score or YouTube calls', () => {
  const candidates = extractPublicEmails([
    { text: 'Contact me@creator.fr', source: 'video_description', publishedAt: new Date().toISOString() },
    { text: 'Business me@creator.fr', source: 'video_description', publishedAt: new Date().toISOString() },
  ])
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].occurrences, 2)

  const youtube = fs.readFileSync('lib/youtube.ts', 'utf8')
  const scoring = fs.readFileSync('lib/prospectScoring.ts', 'utf8')
  assert.match(youtube, /recentVideos\.map/)
  const scoreFunction = scoring.slice(scoring.indexOf('export function calculateProspectScore'))
  assert.doesNotMatch(scoreFunction, /email|website|instagram|tiktok|twitch/i)
  assert.equal((youtube.match(/new URL\('https:\/\/www\.googleapis\.com\/youtube\/v3\//g) || []).length, 3)
})

test('landing page matches current free and Pro product limits without AI promises', () => {
  const landing = fs.readFileSync('app/LandingPage.tsx', 'utf8')
  const metadata = [
    fs.readFileSync('app/layout.tsx', 'utf8'),
    fs.readFileSync('app/page.tsx', 'utf8'),
    fs.readFileSync('app/manifest.ts', 'utf8'),
  ].join('\n')
  assert.equal(PRO_MONTHLY_PRICE_LABEL, '4,90 €')
  assert.deepEqual(PRODUCT_LIMITS, { freeLifetimeSearches: 3, proDailySearches: 5, freeCampaigns: 1, freeCampaignProspects: 5 })
  assert.match(landing, /PRODUCT_LIMITS\.freeLifetimeSearches/)
  assert.match(landing, /PRODUCT_LIMITS\.proDailySearches/)
  assert.match(landing, /campagne d’essai/)
  assert.match(landing, /brouillons Gmail/)
  assert.match(landing, /ne sont pas garanties/)
  assert.doesNotMatch(landing, /message.? IA|grâce à l’IA|recherches? illimité/i)
  assert.doesNotMatch(`${landing}\n${metadata}`, /9,90|9\.90|emails? garantis?|résultats? garantis?/i)
})
