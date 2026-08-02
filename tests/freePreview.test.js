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
} = require('../lib/gmailStatus.ts')
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
  buildYouTubeSearchParams,
  getSafeYouTubeSearchParamsLog,
  normalizeYouTubeLanguage,
} = require('../lib/youtubeSearchParams.ts')
const {
  FREE_LIFETIME_SEARCH_LIMIT,
  PRO_DAILY_SEARCH_LIMIT,
  SEARCH_CACHE_VERSION,
  buildSearchCacheKey,
  getSearchQuotaMessage,
  getUtcDayKey,
  normalizeSearchText,
} = require('../lib/searchPolicy.ts')
const { getSearchQuotaSnapshot } = require('../lib/searchQuota.ts')
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
  assert.match(gmailRoute, /buildGmailStatus\(account, SEND_MODE\)/)
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
    unit_amount: 990,
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

  assert.deepEqual(log.parameterNames, ['fields', 'maxResults', 'part', 'q', 'relevanceLanguage', 'type'])
  assert.equal(log.queryLength, 18)
  assert.doesNotMatch(serialized, /AIza|private query|googleapis|key=/i)
})

test('search cache keys normalize equivalent criteria and remain versioned', () => {
  const first = buildSearchCacheKey({ niche: ' Cuisine ', lang: 'Français', subsMin: 10000, subsMax: 50000 })
  const second = buildSearchCacheKey({ niche: 'cuisine', lang: '  francais  ', subsMin: 10000, subsMax: 50000 })
  const different = buildSearchCacheKey({ niche: 'cuisine', lang: 'francais', subsMin: 10000, subsMax: 100000 })

  assert.equal(first, second)
  assert.notEqual(first, different)
  assert.match(first, new RegExp(`^${SEARCH_CACHE_VERSION}:`))
  assert.equal(normalizeSearchText('  Création   vidéo  '), 'creation-video')
})

test('product search limits are centralized and reset Pro usage by UTC day', () => {
  assert.equal(FREE_LIFETIME_SEARCH_LIMIT, 1)
  assert.equal(PRO_DAILY_SEARCH_LIMIT, 5)
  assert.equal(getUtcDayKey(new Date('2026-08-02T23:59:59.000Z')), '2026-08-02')
  assert.equal(getUtcDayKey(new Date('2026-08-03T00:00:00.000Z')), '2026-08-03')
  assert.match(getSearchQuotaMessage('Gratuit', 1), /1 recherche gratuite/)
  assert.match(getSearchQuotaMessage('Gratuit', 0), /Passez au Plan Pro/)
  assert.match(getSearchQuotaMessage('Pro', 5), /5 recherche/)
})

test('free quota allows one new account and treats existing history as used', async () => {
  const freshDb = {
    search: { count: async () => 0 },
    searchUsage: { count: async () => 0 },
  }
  const existingDb = {
    search: { count: async () => 3 },
    searchUsage: { count: async () => 0 },
  }

  assert.deepEqual(await getSearchQuotaSnapshot(freshDb, 'user-free', 'Gratuit'), {
    limit: 1, used: 0, remaining: 1, periodKey: 'lifetime',
  })
  assert.deepEqual(await getSearchQuotaSnapshot(existingDb, 'user-free', 'Gratuit'), {
    limit: 1, used: 1, remaining: 0, periodKey: 'lifetime',
  })
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
  assert.match(route, /cachedResults\.length >= limits\.results/)
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

test('youtube search uses one search query and batches channel ids', () => {
  const youtubeLib = fs.readFileSync('lib/youtube.ts', 'utf8')

  assert.match(youtubeLib, /MAX_SEARCH_QUERIES\s*=\s*1/)
  assert.match(youtubeLib, /MAX_SEARCH_PAGES_PER_QUERY\s*=\s*1/)
  assert.match(youtubeLib, /for \(let i = 0; i < channelIds\.length; i \+= 50\)/)
  assert.match(youtubeLib, /channelsUrl\.searchParams\.set\('id', batchIds\.join\(','\)\)/)
  assert.match(youtubeLib, /fields/)
  assert.doesNotMatch(youtubeLib, /nextPageToken,error/)
  assert.doesNotMatch(youtubeLib, /brandingSettings\/channel\/description\),error/)
  assert.doesNotMatch(youtubeLib, /searchParams\.set\(['"]video/i)
  assert.doesNotMatch(youtubeLib, /youtube\/v3\/videos/)
})

test('search route uses persistent cache, atomic quotas and cross-instance locks', () => {
  const searchRoute = fs.readFileSync('app/api/search/route.ts', 'utf8')

  assert.match(searchRoute, /prisma\.searchCache\.findFirst/)
  assert.match(searchRoute, /cachedResults\.length >= limits\.results/)
  assert.match(searchRoute, /selectDiverseProspectPreview\(cachedResults, limits\.results\)/)
  assert.match(searchRoute, /acquireSearchLock/)
  assert.match(searchRoute, /reserveSearchQuota/)
  assert.match(searchRoute, /completeSearchQuota/)
  assert.match(searchRoute, /releaseSearchQuota/)
  assert.match(searchRoute, /SEARCH_ALREADY_RUNNING/)
  assert.match(searchRoute, /FREE_SEARCH_USED/)
  assert.match(searchRoute, /PRO_DAILY_SEARCH_LIMIT_REACHED/)
  assert.match(searchRoute, /algorithmVersion: SEARCH_CACHE_VERSION/)
  assert.match(searchRoute, /buildYouTubeErrorResponse/)
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
  const youtubeLib = fs.readFileSync('lib/youtube.ts', 'utf8')

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
  assert.match(youtubeLib, /PROSPECT_SCORE_THRESHOLDS\.exceptional/)
  assert.match(youtubeLib, /PROSPECT_SCORE_THRESHOLDS\.excellent/)
  assert.match(youtubeLib, /PROSPECT_SCORE_THRESHOLDS\.good/)
  assert.match(youtubeLib, /PROSPECT_SCORE_THRESHOLDS\.medium/)
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

test('prospect score algorithm weights stay unchanged', () => {
  const youtubeLib = fs.readFileSync('lib/youtube.ts', 'utf8')

  for (const pattern of [
    /channel\.email\)\s*\{\s*score \+= 20/s,
    /channel\.instagram\)\s*\{\s*score \+= 8/s,
    /channel\.tiktok\)\s*\{\s*score \+= 8/s,
    /channel\.twitch\)\s*\{\s*score \+= 5/s,
    /channel\.website\)\s*\{\s*score \+= 5/s,
    /subsNum >= 10000 && channel\.subsNum <= 300000\)\s*\{\s*score \+= 20/s,
    /subsNum > 300000 && channel\.subsNum <= 1000000\)\s*\{\s*score \+= 12/s,
    /channel\.videoCount > 100\)\s*\{\s*score \+= 10/s,
    /channel\.viewCount > 1000000\)\s*\{\s*score \+= 10/s,
    /channel\.viewsPerSubscriber > 20\)\s*\{\s*score \+= 10/s,
    /channel\.channelAge !== null && channel\.channelAge < 5\)\s*\{\s*score \+= 5/s,
    /channel\.desc && channel\.desc\.length > 100\)\s*\{\s*score \+= 5/s,
    /Math\.min\(score, 100\)/,
  ]) {
    assert.match(youtubeLib, pattern)
  }
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
  assert.match(sources, /9,90/)
  assert.doesNotMatch(checkoutRoute, /discounts/)
  assert.doesNotMatch(checkoutRoute, /allow_promotion_codes/)
  assert.doesNotMatch(checkoutRoute, /promotion_code|coupon/)
  assert.doesNotMatch(sources, /STRIPE_LAUNCH_PROMOTION_ID/)
  assert.doesNotMatch(sources, /4,95|4\.95|4,90|4\.90/)
  assert.doesNotMatch(sources, /offre de lancement|Offre de lancement|5 places/)
})
