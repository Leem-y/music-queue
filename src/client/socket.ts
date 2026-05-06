/* eslint-disable no-console */
"use client"

import { io, type Socket } from "socket.io-client"

import type { ClientToServerEvents, ServerToClientEvents } from "@/shared/events"
import { getOrCreateSessionId } from "@/client/session"

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null

export function getSocket() {
  if (typeof window === "undefined") return null
  if (socket) return socket

  const sessionId = getOrCreateSessionId()
  socket = io({
    path: "/socket.io",
    // Don't force websocket-only; many LAN setups (phones/guest wifi)
    // can block websockets. Let Socket.IO fall back to polling.
    transports: ["websocket", "polling"],
    auth: { sessionId },
  })

  socket.on("connect_error", (err) => console.warn("socket connect_error", err))
  return socket
}

