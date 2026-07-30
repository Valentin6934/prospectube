export const CAMPAIGN_SEND_LIMIT = 20

export type CampaignSendProspect = {
  email?: string | null
  generatedSubject?: string | null
  generatedBody?: string | null
  sendStatus?: string | null
}

export type CampaignSendResult = {
  success: boolean
  skippedReason?: 'not_found' | 'no_email' | 'incomplete_message' | 'already_processed'
}

export type CampaignSendSummary = {
  successCount: number
  failureCount: number
  skippedNoEmailCount: number
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
  return Boolean(prospect.generatedSubject?.trim() && prospect.generatedBody?.trim())
}

export function isCampaignProspectAlreadyProcessed(prospect: CampaignSendProspect): boolean {
  return prospect.sendStatus === 'Envoyé' || prospect.sendStatus === 'Brouillon créé'
}

export function isCampaignProspectSendEligible(prospect: CampaignSendProspect): boolean {
  return (
    hasValidCampaignEmail(prospect.email) &&
    hasCompleteCampaignMessage(prospect) &&
    !isCampaignProspectAlreadyProcessed(prospect)
  )
}

export function limitUniqueCampaignSelection(ids: string[], limit = CAMPAIGN_SEND_LIMIT): string[] {
  return Array.from(new Set(ids.filter(id => typeof id === 'string' && id.length > 0))).slice(0, limit)
}

export function getCampaignSendSummary(results: CampaignSendResult[]): CampaignSendSummary {
  const successCount = results.filter(result => result.success).length
  const skippedNoEmailCount = results.filter(result => result.skippedReason === 'no_email').length
  const skippedIncompleteCount = results.filter(result => result.skippedReason === 'incomplete_message').length
  const skippedAlreadyProcessedCount = results.filter(result => result.skippedReason === 'already_processed').length
  const skippedNotFoundCount = results.filter(result => result.skippedReason === 'not_found').length
  const failureCount = results.filter(result => !result.success && !result.skippedReason).length
  const errorCount =
    failureCount +
    skippedNoEmailCount +
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
    skippedIncompleteCount,
    skippedAlreadyProcessedCount,
    skippedNotFoundCount,
    errorCount,
    campaignResultStatus,
  }
}
