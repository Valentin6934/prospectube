export const CAMPAIGN_SEND_LIMIT = 20

export type CampaignSendProspect = {
  id?: string | null
  email?: string | null
  generatedSubject?: string | null
  generatedBody?: string | null
  sendStatus?: string | null
}

export type CampaignMessageDraft = {
  subject?: string | null
  body?: string | null
}

export type CampaignSendResult = {
  success: boolean
  skippedReason?: CampaignSkipReason
}

export type CampaignSkipReason = 'not_found' | 'no_email' | 'no_subject' | 'no_body' | 'incomplete_message' | 'already_processed'

export type CampaignSendSummary = {
  successCount: number
  failureCount: number
  skippedNoEmailCount: number
  skippedNoSubjectCount: number
  skippedNoBodyCount: number
  skippedIncompleteCount: number
  skippedAlreadyProcessedCount: number
  skippedNotFoundCount: number
  errorCount: number
  campaignResultStatus: 'Envoyee' | 'Partiellement envoyee' | 'Aucun email envoye'
}

export function hasValidCampaignEmail(email?: string | null): email is string {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
}

export function hasCompleteCampaignMessage(prospect: CampaignSendProspect): boolean {
  const message = normalizeCampaignMessage({
    subject: prospect.generatedSubject,
    body: prospect.generatedBody,
  })
  return Boolean(message.subject && message.body)
}

export function normalizeCampaignMessage(draft: CampaignMessageDraft) {
  return {
    subject: typeof draft.subject === 'string' ? draft.subject.trim() : '',
    body: typeof draft.body === 'string' ? draft.body.trim() : '',
  }
}

export function getCampaignProspectWithDraft<T extends CampaignSendProspect>(
  prospect: T,
  draft?: CampaignMessageDraft | null
): T {
  const normalized = normalizeCampaignMessage({
    subject: draft?.subject ?? prospect.generatedSubject,
    body: draft?.body ?? prospect.generatedBody,
  })

  return {
    ...prospect,
    generatedSubject: normalized.subject,
    generatedBody: normalized.body,
  }
}

export function hasCampaignDraftChanges(
  prospect: CampaignSendProspect,
  draft?: CampaignMessageDraft | null
): boolean {
  if (!draft) return false
  const persisted = normalizeCampaignMessage({
    subject: prospect.generatedSubject,
    body: prospect.generatedBody,
  })
  const current = normalizeCampaignMessage(draft)

  return persisted.subject !== current.subject || persisted.body !== current.body
}

export function getCampaignGmailActionLabel(sendMode?: 'draft' | 'send', count?: number): string {
  const suffix = typeof count === 'number' ? ` (${Math.min(count, CAMPAIGN_SEND_LIMIT)})` : ''
  return sendMode === 'send' ? `Envoyer${suffix}` : `Créer les brouillons${suffix}`
}

export function getCampaignGmailSingleActionLabel(sendMode?: 'draft' | 'send'): string {
  return sendMode === 'send' ? 'Envoyer' : 'Créer brouillon'
}

export function getCampaignGmailProgressLabel(sendMode?: 'draft' | 'send'): string {
  return sendMode === 'send' ? 'Envoi...' : 'Création...'
}

export function getCampaignManualSendPlan<T extends CampaignSendProspect & { id: string }>(
  prospects: T[],
  drafts: Record<string, CampaignMessageDraft>,
  selectedIds: string[]
) {
  const selectedProspects = prospects.filter(prospect => selectedIds.includes(prospect.id))
  const prospectsWithDrafts = selectedProspects.map(prospect =>
    getCampaignProspectWithDraft(prospect, drafts[prospect.id])
  )
  const eligibleProspects = prospectsWithDrafts.filter(isCampaignProspectSendEligible)
  const prospectsToSave = eligibleProspects.filter(prospect => {
    const persistedProspect = selectedProspects.find(item => item.id === prospect.id)
    return persistedProspect ? hasCampaignDraftChanges(persistedProspect, drafts[prospect.id]) : false
  })

  return {
    selectedProspects,
    prospectsWithDrafts,
    eligibleProspects,
    prospectsToSave,
  }
}

export function getCampaignDraftCreationPlan<T extends CampaignSendProspect & { id: string }>(
  prospects: T[],
  drafts: Record<string, CampaignMessageDraft>,
  selectedIds: string[]
) {
  const plan = getCampaignManualSendPlan(prospects, drafts, selectedIds)
  const readyProspects = plan.eligibleProspects.slice(0, CAMPAIGN_SEND_LIMIT)

  return {
    ...plan,
    readyProspects,
    readyIds: readyProspects.map(prospect => prospect.id),
    readyCount: readyProspects.length,
  }
}

export function isCampaignProspectAlreadyProcessed(prospect: CampaignSendProspect): boolean {
  const status = (prospect.sendStatus || '').toLowerCase().replace(/\s+/g, ' ')
  if (status.includes('non envoy')) return false
  return status.includes('envoy') || status.includes('brouillon')
}

export function isCampaignProspectSendEligible(prospect: CampaignSendProspect): boolean {
  return getCampaignProspectSkipReason(prospect) === null
}

export function getCampaignProspectSkipReason(prospect: CampaignSendProspect): CampaignSkipReason | null {
  if (!hasValidCampaignEmail(prospect.email)) return 'no_email'

  const message = normalizeCampaignMessage({
    subject: prospect.generatedSubject,
    body: prospect.generatedBody,
  })
  if (!message.subject) return 'no_subject'
  if (!message.body) return 'no_body'

  if (isCampaignProspectAlreadyProcessed(prospect)) return 'already_processed'
  return null
}

export function limitUniqueCampaignSelection(ids: string[], limit = CAMPAIGN_SEND_LIMIT): string[] {
  return Array.from(new Set(ids.filter(id => typeof id === 'string' && id.length > 0))).slice(0, limit)
}

export function getCampaignSendSummary(results: CampaignSendResult[]): CampaignSendSummary {
  const successCount = results.filter(result => result.success).length
  const skippedNoEmailCount = results.filter(result => result.skippedReason === 'no_email').length
  const skippedNoSubjectCount = results.filter(result => result.skippedReason === 'no_subject').length
  const skippedNoBodyCount = results.filter(result => result.skippedReason === 'no_body').length
  const skippedIncompleteCount = results.filter(result => result.skippedReason === 'incomplete_message').length
  const skippedAlreadyProcessedCount = results.filter(result => result.skippedReason === 'already_processed').length
  const skippedNotFoundCount = results.filter(result => result.skippedReason === 'not_found').length
  const failureCount = results.filter(result => !result.success && !result.skippedReason).length
  const errorCount =
    failureCount +
    skippedNoEmailCount +
    skippedNoSubjectCount +
    skippedNoBodyCount +
    skippedIncompleteCount +
    skippedAlreadyProcessedCount +
    skippedNotFoundCount

  let campaignResultStatus: CampaignSendSummary['campaignResultStatus'] = 'Aucun email envoye'
  if (successCount > 0 && errorCount === 0) campaignResultStatus = 'Envoyee'
  else if (successCount > 0) campaignResultStatus = 'Partiellement envoyee'

  return {
    successCount,
    failureCount,
    skippedNoEmailCount,
    skippedNoSubjectCount,
    skippedNoBodyCount,
    skippedIncompleteCount,
    skippedAlreadyProcessedCount,
    skippedNotFoundCount,
    errorCount,
    campaignResultStatus,
  }
}
