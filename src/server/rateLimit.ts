const lastAddBySession = new Map<string, number>()

const COOLDOWN_MS = 3000

export function canAddToQueueOrThrow(sessionId: string) {
  const now = Date.now()
  const last = lastAddBySession.get(sessionId) ?? 0
  const elapsed = now - last
  if (elapsed < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000)
    throw new Error(`Slow down — try again in ${remaining}s`)
  }
  lastAddBySession.set(sessionId, now)
}

