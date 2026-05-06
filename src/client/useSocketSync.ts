"use client"

import { useEffect } from "react"
import { toast } from "sonner"

import { getSocket } from "@/client/socket"
import { useAppStore } from "@/client/store"

export function useSocketSync() {
  const setFullState = useAppStore((s) => s.setFullState)
  const setQueue = useAppStore((s) => s.setQueue)
  const setNowPlaying = useAppStore((s) => s.setNowPlaying)
  const setUsersCount = useAppStore((s) => s.setUsersCount)
  const setRole = useAppStore((s) => s.setRole)
  const setRecommendations = useAppStore((s) => s.setRecommendations)
  const setPairing = useAppStore((s) => s.setPairing)

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    socket.on("state:full", setFullState)
    socket.on("queue:updated", ({ queue }) => setQueue(queue))
    socket.on("nowPlaying:updated", ({ nowPlaying }) => setNowPlaying(nowPlaying))
    socket.on("users:count", ({ count }) => setUsersCount(count))
    socket.on("admin:status", ({ role }) => setRole(role))
    socket.on("admin:pairing", ({ pairingCode, pairingCodeTtlMs }) => setPairing(pairingCode, pairingCodeTtlMs))
    socket.on("recommendations:updated", ({ items, autoplayAt }) => setRecommendations(items, autoplayAt))
    socket.on("toast", ({ type, message }) => {
      if (type === "error") toast.error(message)
      else if (type === "success") toast.success(message)
      else toast(message)
    })

    return () => {
      socket.off("state:full", setFullState)
      socket.off("queue:updated")
      socket.off("nowPlaying:updated")
      socket.off("users:count")
      socket.off("admin:status")
      socket.off("admin:pairing")
      socket.off("recommendations:updated")
      socket.off("toast")
    }
  }, [setFullState, setNowPlaying, setPairing, setQueue, setRecommendations, setRole, setUsersCount])
}

