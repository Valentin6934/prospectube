export type CampaignMessageDraft = {
  subject?: string | null
  body?: string | null
  generatedSubject?: string | null
  generatedBody?: string | null
}

export function normalizeCampaignMessage(draft: CampaignMessageDraft) {
  return {
    subject: typeof (draft.subject ?? draft.generatedSubject) === 'string' ? (draft.subject ?? draft.generatedSubject)?.trim() || '' : '',
    body: typeof (draft.body ?? draft.generatedBody) === 'string' ? (draft.body ?? draft.generatedBody)?.trim() || '' : '',
  }
}

export function hasCampaignDraftChanges(
  persisted: CampaignMessageDraft,
  draft?: CampaignMessageDraft | null
): boolean {
  if (!draft) return false
  const previous = normalizeCampaignMessage(persisted)
  const current = normalizeCampaignMessage(draft)
  return previous.subject !== current.subject || previous.body !== current.body
}

export function limitUniqueCampaignSelection(ids: string[], limit = 20): string[] {
  return Array.from(new Set(ids.filter(id => typeof id === 'string' && id.length > 0))).slice(0, limit)
}
