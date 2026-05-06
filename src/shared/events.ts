export type Role = "guest" | "admin"

export type QueueItemDTO = {
  id: string
  provider: string
  trackId: string
  title: string
  artist: string | null
  thumbnailUrl: string | null
  durationSec: number | null
  audioUrl: string | null
  addedByName: string | null
  addedAt: string
  position: number
}

export type NowPlayingDTO = {
  provider: string | null
  trackId: string | null
  title: string | null
  artist: string | null
  thumbnailUrl: string | null
  durationSec: number | null
  audioUrl: string | null
  startedAt: string | null
  isPaused: boolean
  isLobby: boolean
}

export type RecommendationDTO = {
  provider: string
  trackId: string
  title: string
  artist: string | null
  thumbnailUrl: string | null
  durationSec: number | null
  audioUrl: string | null
  reason: "most_played" | "recently_popular"
}

export type FullStateDTO = {
  me: {
    sessionId: string
    name: string | null
    role: Role
    isHostDisplay: boolean
  }
  users: {
    count: number
  }
  queue: QueueItemDTO[]
  nowPlaying: NowPlayingDTO
  recommendations: {
    items: RecommendationDTO[]
    autoplayAt: string | null
  }
  admin: {
    pairingCode: string
    pairingCodeTtlMs: number
  }
}

export type ClientToServerEvents = {
  "queue:add": (payload: { provider: string; trackId: string }) => void
  "queue:remove": (payload: { queueItemId: string }) => void
  "queue:reorder": (payload: { orderedQueueItemIds: string[] }) => void
  "queue:clear": () => void
  "playback:skip": () => void
  "playback:pauseToggle": () => void
  "playback:ended": (payload: { provider: string; trackId: string }) => void
  "playback:error": (payload: { provider: string; trackId: string; message?: string }) => void
  "admin:pair": (payload: { code: string }) => void
  "admin:revoke": () => void
  "me:setName": (payload: { name: string }) => void
}

export type ServerToClientEvents = {
  "state:full": (state: FullStateDTO) => void
  "queue:updated": (payload: { queue: QueueItemDTO[] }) => void
  "nowPlaying:updated": (payload: { nowPlaying: NowPlayingDTO }) => void
  "users:count": (payload: { count: number }) => void
  "admin:status": (payload: { role: Role }) => void
  "admin:pairing": (payload: { pairingCode: string; pairingCodeTtlMs: number }) => void
  "recommendations:updated": (payload: { items: RecommendationDTO[]; autoplayAt: string | null }) => void
  "toast": (payload: { type: "success" | "error" | "info"; message: string }) => void
}

