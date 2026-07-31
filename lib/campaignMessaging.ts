export type CampaignAiProspect = {
  name: string
  email: string | null
  instagram: string | null
  tiktok: string | null
  twitch: string | null
  website: string | null
  channelUrl: string | null
  score: number | null
  scoreLabel: string | null
  scoreReason: string | null
}

export function buildCampaignAiPrompt(prospect: CampaignAiProspect): string {
  return `Tu es un monteur video freelance qui prospecte des createurs YouTube.

Genere un message de prospection court, naturel et personnalise pour ce prospect :

Nom : ${prospect.name}
Email : ${prospect.email || 'Non trouve'}
Instagram : ${prospect.instagram || 'Non trouve'}
TikTok : ${prospect.tiktok || 'Non trouve'}
Twitch : ${prospect.twitch || 'Non trouve'}
Site web : ${prospect.website || 'Non trouve'}
Chaine YouTube : ${prospect.channelUrl || 'Non trouve'}
Score prospect : ${prospect.score || 0}/100
Label score : ${prospect.scoreLabel || 'Non trouve'}
Raison score : ${prospect.scoreReason || 'Non trouve'}

Regles :
- Message court : maximum 120 mots
- Ton professionnel mais humain
- Propose clairement ton aide pour ameliorer le montage video
- Ne dis pas "je suis une IA"
- Ne force pas trop la vente
- Format exact :
Objet: [sujet]

[corps du message]`
}

export function parseCampaignAiText(text: string, fallbackName: string) {
  const cleanText = text.trim()
  if (!cleanText) {
    throw new Error('La reponse IA est vide.')
  }

  const lines = cleanText.split('\n')
  const firstLine = lines[0] || ''
  const hasSubjectPrefix = /^(\s*)(objet|subject)\s*:/i.test(firstLine)
  const subject = hasSubjectPrefix
    ? firstLine.replace(/^(\s*)(objet|subject)\s*:/i, '').trim()
    : `Collaboration avec ${fallbackName}`
  const body = hasSubjectPrefix ? lines.slice(1).join('\n').trim() : cleanText

  if (!body) {
    throw new Error('Le corps du message IA est vide.')
  }

  return {
    subject: subject || `Collaboration avec ${fallbackName}`,
    body,
  }
}

export function getCampaignAiConfigError(apiKey?: string | null): string | null {
  return apiKey?.trim() ? null : 'La generation IA est temporairement indisponible.'
}
