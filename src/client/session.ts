import { nanoid } from "nanoid"

const KEY = "mq.sessionId"

export function getOrCreateSessionId() {
  if (typeof window === "undefined") return null
  const existing = window.localStorage.getItem(KEY)
  if (existing) return existing
  const id = nanoid()
  window.localStorage.setItem(KEY, id)
  return id
}

