export type CampaignApiResponse<T = unknown> = {
  campaign?: T
  error?: string
}

export function buildCampaignDetailUrl(campaignId: string): string {
  return `/campaigns?campaignId=${encodeURIComponent(campaignId)}`
}

export function getCampaignIdFromCreateResponse(response: CampaignApiResponse<{ id?: unknown }>): string | null {
  return typeof response.campaign?.id === 'string' && response.campaign.id.trim()
    ? response.campaign.id
    : null
}

export function getCampaignFromApiResponse<T>(response: CampaignApiResponse<T>): T | null {
  return response.campaign || null
}

export function buildCampaignProspectPayload(channel: Record<string, unknown>) {
  const channelId = typeof channel.channelId === 'string' && channel.channelId.trim()
    ? channel.channelId
    : typeof channel.id === 'string' && channel.id.trim()
      ? channel.id
      : null

  return {
    ...channel,
    channelId,
  }
}
