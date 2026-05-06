"use client"

import { create } from "zustand"

import type { FullStateDTO, RecommendationDTO, QueueItemDTO, NowPlayingDTO, Role } from "@/shared/events"

type AppState = {
  sessionId: string | null
  name: string | null
  role: Role
  isHostDisplay: boolean
  usersCount: number
  queue: QueueItemDTO[]
  nowPlaying: NowPlayingDTO
  recommendations: { items: RecommendationDTO[]; autoplayAt: string | null }
  pairingCode: string
  pairingCodeTtlMs: number
  setFullState: (s: FullStateDTO) => void
  setQueue: (q: QueueItemDTO[]) => void
  setNowPlaying: (np: NowPlayingDTO) => void
  setUsersCount: (count: number) => void
  setRecommendations: (items: RecommendationDTO[], autoplayAt: string | null) => void
  setRole: (role: Role) => void
  setPairing: (pairingCode: string, pairingCodeTtlMs: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  sessionId: null,
  name: null,
  role: "guest",
  isHostDisplay: false,
  usersCount: 0,
  queue: [],
  nowPlaying: {
    provider: null,
    trackId: null,
    title: null,
    artist: null,
    thumbnailUrl: null,
    durationSec: null,
    audioUrl: null,
    startedAt: null,
    isPaused: false,
    isLobby: false,
  },
  recommendations: { items: [], autoplayAt: null },
  pairingCode: "------",
  pairingCodeTtlMs: 0,
  setFullState: (s) =>
    set(() => ({
      sessionId: s.me.sessionId,
      name: s.me.name,
      role: s.me.role,
      isHostDisplay: s.me.isHostDisplay,
      usersCount: s.users.count,
      queue: s.queue,
      nowPlaying: s.nowPlaying,
      recommendations: s.recommendations,
      pairingCode: s.admin.pairingCode,
      pairingCodeTtlMs: s.admin.pairingCodeTtlMs,
    })),
  setQueue: (queue) => set(() => ({ queue })),
  setNowPlaying: (nowPlaying) => set(() => ({ nowPlaying })),
  setUsersCount: (usersCount) => set(() => ({ usersCount })),
  setRecommendations: (items, autoplayAt) =>
    set(() => ({ recommendations: { items, autoplayAt } })),
  setRole: (role) => set(() => ({ role })),
  setPairing: (pairingCode, pairingCodeTtlMs) => set(() => ({ pairingCode, pairingCodeTtlMs })),
}))

