type ScoredProspect = {
  score?: number | null
  id?: string | null
  channelId?: string | null
}

function prospectKey(prospect: ScoredProspect, fallback: number) {
  return prospect.channelId || prospect.id || `prospect-${fallback}`
}

export function selectDiverseProspectPreview<T extends ScoredProspect>(
  prospects: T[],
  limit = 3
): T[] {
  if (limit <= 0 || prospects.length === 0) return []
  if (prospects.length <= limit) return [...prospects].sort((a, b) => (b.score || 0) - (a.score || 0))

  const sorted = [...prospects].sort((a, b) => (b.score || 0) - (a.score || 0))
  const picks: T[] = []
  const pickedKeys = new Set<string>()

  const addPick = (prospect: T | undefined, index: number) => {
    if (!prospect) return
    const key = prospectKey(prospect, index)
    if (pickedKeys.has(key)) return
    pickedKeys.add(key)
    picks.push(prospect)
  }

  addPick(sorted[0], 0)
  addPick(sorted[Math.floor((sorted.length - 1) / 2)], 1)
  addPick(sorted[sorted.length - 1], 2)

  for (const prospect of sorted) {
    if (picks.length >= limit) break
    addPick(prospect, picks.length)
  }

  return picks.slice(0, limit)
}
