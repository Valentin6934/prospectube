import { countContactChannels, type ContactChannelInput } from './contactChannels'
import { MIN_BILLABLE_SEARCH_RESULTS } from './searchPolicy'

export type SearchValueAssessment = {
  resultCount: number
  contactableCount: number
  consumeQuota: boolean
  message: string | null
}

export function assessSearchValue(results: ContactChannelInput[]): SearchValueAssessment {
  const resultCount = results.length
  const contactableCount = results.filter(result => countContactChannels(result) > 0).length
  const enoughResults = resultCount >= MIN_BILLABLE_SEARCH_RESULTS
  const consumeQuota = enoughResults && contactableCount > 0
  const message = consumeQuota ? null : resultCount === 0
    ? 'Aucun créateur ne correspond exactement à cette cible. Cette recherche n’a pas été décomptée.'
    : contactableCount === 0
      ? 'Peu de créateurs exploitables ont été trouvés et aucun canal public n’est disponible. Cette recherche n’a pas été décomptée.'
      : `Seulement ${resultCount} créateur${resultCount > 1 ? 's' : ''} correspond${resultCount > 1 ? 'ent' : ''} à cette cible. Cette recherche n’a pas été décomptée.`
  return { resultCount, contactableCount, consumeQuota, message }
}
