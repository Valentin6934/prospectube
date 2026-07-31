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
    { id: 'processed', email: 'done@example.com', generatedSubject: 'Sujet', generatedBody: 'Message', sendStatus: 'Brouillon cree' },
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
    sendStatus: 'Brouillon cree',
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
  assert.equal(getCampaignGmailSingleActionLabel('draft'), 'Créer brouillon')
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
  assert.match(callbackRoute, /getServerSession\(authOptions\)/)
  assert.match(callbackRoute, /prisma\.googleAccount\.upsert/)
  assert.match(callbackRoute, /accessToken:\s*tokens\.access_token/)
  assert.match(callbackRoute, /refreshToken,/)
  assert.match(gmailRoute, /export async function DELETE/)
  assert.match(gmailRoute, /where:\s*\{\s*userId:\s*user\.id\s*\}/)
  assert.match(gmailRoute, /scope:\s*true/)
  assert.match(gmailRoute, /buildDisconnectedGmailStatus/)
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
  assert.match(campaignsPage, /Aucun email disponible/)
  assert.match(campaignsPage, /Message incomplet/)
  assert.match(campaignsPage, /Créer les brouillons Gmail/)
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
