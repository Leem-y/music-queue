import type { Server as SocketIOServer, Socket } from "socket.io"

import { nanoid } from "nanoid"

import type {
  ClientToServerEvents,
  FullStateDTO,
  NowPlayingDTO,
  QueueItemDTO,
  ServerToClientEvents,
} from "@/shared/events"
import { prisma } from "@/server/db"
import { canAddToQueueOrThrow } from "@/server/rateLimit"
import { getOrRotatePairingCode, isValidPairingCode } from "@/server/pairing"
import { getMusicProvider } from "@/server/music/provider"
import { getRecommendations, recordPlay } from "@/server/recommendations"

type IOServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents>
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>

const pairingCodeTtlMs = 60_000

const usersState = {
  count: 0,
}

const recState: {
  items: FullStateDTO["recommendations"]["items"]
} = {
  items: [],
}

function normalizeYouTubeId(input: unknown): string | null {
  const s = String(input ?? "").trim()
  return /^[a-zA-Z0-9_-]{11}$/.test(s) ? s : null
}

function resolveLobbyYoutubeId(): string | null {
  const raw = process.env.NEXT_PUBLIC_LOBBY_YOUTUBE_ID
  if (raw === "") return null
  const v = normalizeYouTubeId(raw ?? "jfKfPfyJRdk")
  return v ?? "jfKfPfyJRdk"
}

const lobbyYoutubeId = resolveLobbyYoutubeId()

function lobbyMeta(youtubeId: string) {
  return {
    title: "Lobby",
    artist: "Waiting for someone to queue a song",
    thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
    durationSec: null as number | null,
  }
}

function emitRecommendations(io: IOServer) {
  io.emit("recommendations:updated", {
    items: recState.items,
    autoplayAt: null,
  })
}

async function ensureIdleLobbyNowPlaying(io: IOServer) {
  if (!lobbyYoutubeId) return
  await ensureNowPlayingRow()

  const [queueCount, np] = await Promise.all([
    prisma.queueItem.count(),
    prisma.nowPlaying.findUnique({ where: { id: 1 } }),
  ])
  if (queueCount !== 0) return

  const current = normalizeYouTubeId(np?.youtubeId)
  if (current === lobbyYoutubeId) return

  await prisma.nowPlaying.update({
    where: { id: 1 },
    data: { youtubeId: lobbyYoutubeId, queueItemId: null, startedAt: new Date(), isPaused: false },
  })
  io.emit("nowPlaying:updated", { nowPlaying: await fetchNowPlayingDTO() })
}

async function updateRecommendationsAndAutoplay(io: IOServer) {
  await ensureNowPlayingRow()
  const [queueCount, nowPlaying] = await Promise.all([
    prisma.queueItem.count(),
    prisma.nowPlaying.findUnique({ where: { id: 1 } }),
  ])

  const isLobbyNowPlaying = !!(lobbyYoutubeId && nowPlaying?.youtubeId === lobbyYoutubeId)
  const isIdle = queueCount === 0 && (!nowPlaying?.youtubeId || isLobbyNowPlaying)
  if (!isIdle) {
    if (recState.items.length) {
      recState.items = []
      emitRecommendations(io)
    }
    return
  }

  // If we are idle, make sure the host is actually playing lobby music.
  await ensureIdleLobbyNowPlaying(io)

  if (!recState.items.length) {
    recState.items = await getRecommendations(10)
  }

  emitRecommendations(io)
}

async function ensureNowPlayingRow() {
  await prisma.nowPlaying.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, isPaused: false },
  })
}

const HOST_ROOM = "hosts"

function isHostClient(socket: IOSocket): boolean {
  const ct = socket.handshake.auth?.clientType
  if (ct !== "host") return false
  const allowed = String(process.env.HOST_TV_IP ?? "").trim()
  if (!allowed) return true // if not configured, allow any host clientType

  const ipRaw =
    (socket.handshake.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    socket.handshake.address ??
    ""
  const ip = ipRaw.replace(/^::ffff:/, "")
  // Allow the host machine itself even if the browser connects via loopback.
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true
  return ip === allowed
}

function toQueueItemDTO(row: {
  id: string
  youtubeId: string
  title: string
  artist: string | null
  thumbnailUrl: string | null
  durationSec: number | null
  position: number
  addedAt: Date
  addedBy: { name: string | null } | null
}): QueueItemDTO {
  return {
    id: row.id,
    youtubeId: row.youtubeId,
    title: row.title,
    artist: row.artist,
    thumbnailUrl: row.thumbnailUrl,
    durationSec: row.durationSec,
    addedByName: row.addedBy?.name ?? null,
    addedAt: row.addedAt.toISOString(),
    position: row.position,
  }
}

function toNowPlayingDTO(row: {
  youtubeId: string | null
  startedAt: Date | null
  isPaused: boolean
  meta?: { title: string; artist: string | null; thumbnailUrl: string | null; durationSec: number | null } | null
}): NowPlayingDTO {
  const youtubeId = normalizeYouTubeId(row.youtubeId)
  const isLobby = !!(lobbyYoutubeId && youtubeId && youtubeId === lobbyYoutubeId)
  const lm = isLobby && lobbyYoutubeId ? lobbyMeta(lobbyYoutubeId) : null
  return {
    youtubeId,
    title: row.meta?.title ?? lm?.title ?? null,
    artist: row.meta?.artist ?? lm?.artist ?? null,
    thumbnailUrl: row.meta?.thumbnailUrl ?? lm?.thumbnailUrl ?? null,
    durationSec: row.meta?.durationSec ?? lm?.durationSec ?? null,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    isPaused: row.isPaused,
    isLobby,
  }
}

async function buildFullState(
  session: { id: string; name: string | null; role: "guest" | "admin" },
  opts: { includePairingCode: boolean },
): Promise<FullStateDTO> {
  await ensureNowPlayingRow()

  const [queue, nowPlaying] = await Promise.all([
    prisma.queueItem.findMany({
      orderBy: { position: "asc" },
      include: { addedBy: { select: { name: true } } },
    }),
    prisma.nowPlaying.findUnique({ where: { id: 1 } }),
  ])

  const pairing = opts.includePairingCode ? getOrRotatePairingCode(pairingCodeTtlMs) : null
  const meta = nowPlaying?.youtubeId
    ? await prisma.songMetadata.findUnique({ where: { youtubeId: nowPlaying.youtubeId } })
    : null

  return {
    me: { sessionId: session.id, name: session.name, role: session.role, isHostDisplay: opts.includePairingCode },
    users: { count: usersState.count },
    queue: queue.map(toQueueItemDTO),
    nowPlaying: toNowPlayingDTO({
      youtubeId: nowPlaying?.youtubeId ?? null,
      startedAt: nowPlaying?.startedAt ?? null,
      isPaused: nowPlaying?.isPaused ?? false,
      meta: meta
        ? {
            title: meta.title,
            artist: meta.artist,
            thumbnailUrl: meta.thumbnailUrl,
            durationSec: meta.durationSec,
          }
        : null,
    }),
    recommendations: {
      items: recState.items,
      autoplayAt: null,
    },
    // Never send the pairing code to guest clients.
    admin: { pairingCode: pairing?.code ?? "", pairingCodeTtlMs: pairing?.ttlMs ?? 0 },
  }
}

async function fetchQueueDTOs() {
  const queue = await prisma.queueItem.findMany({
    orderBy: { position: "asc" },
    include: { addedBy: { select: { name: true } } },
  })
  return queue.map(toQueueItemDTO)
}

async function fetchNowPlayingDTO() {
  await ensureNowPlayingRow()
  const nowPlaying = await prisma.nowPlaying.findUnique({ where: { id: 1 } })
  const meta = nowPlaying?.youtubeId
    ? await prisma.songMetadata.findUnique({ where: { youtubeId: nowPlaying.youtubeId } })
    : null
  return toNowPlayingDTO({
    youtubeId: nowPlaying?.youtubeId ?? null,
    startedAt: nowPlaying?.startedAt ?? null,
    isPaused: nowPlaying?.isPaused ?? false,
    meta: meta
      ? {
          title: meta.title,
          artist: meta.artist,
          thumbnailUrl: meta.thumbnailUrl,
          durationSec: meta.durationSec,
        }
      : null,
  })
}

async function advanceQueueAndBroadcast(io: IOServer) {
  await ensureNowPlayingRow()

  const next = await prisma.queueItem.findFirst({ orderBy: { position: "asc" } })
  if (!next) {
    await prisma.nowPlaying.update({
      where: { id: 1 },
      data: { youtubeId: lobbyYoutubeId ?? null, queueItemId: null, startedAt: lobbyYoutubeId ? new Date() : null, isPaused: false },
    })
    io.emit("nowPlaying:updated", { nowPlaying: await fetchNowPlayingDTO() })
    await updateRecommendationsAndAutoplay(io)
    return
  }

  const nextId = normalizeYouTubeId(next.youtubeId)
  if (!nextId) {
    // Defensive: if a bad id somehow got into the queue, drop it and continue.
    await prisma.queueItem.delete({ where: { id: next.id } }).catch(() => null)
    await advanceQueueAndBroadcast(io)
    return
  }

  // Important: do NOT set queueItemId to a row we are about to delete.
  // The queue item is a transient "request"; once it becomes now-playing, it exits the queue.
  await prisma.$transaction(async (tx) => {
    await tx.nowPlaying.update({
      where: { id: 1 },
      data: {
        youtubeId: nextId,
        queueItemId: null,
        startedAt: new Date(),
        isPaused: false,
      },
    })
    await tx.queueItem.delete({ where: { id: next.id } })

    const remaining = await tx.queueItem.findMany({ orderBy: { position: "asc" }, select: { id: true } })
    await tx.$transaction(
      remaining.map((item, idx) => tx.queueItem.update({ where: { id: item.id }, data: { position: idx + 1 } })),
    )
  })

  io.emit("nowPlaying:updated", { nowPlaying: await fetchNowPlayingDTO() })
  io.emit("queue:updated", { queue: await fetchQueueDTOs() })
  if (recState.items.length) {
    recState.items = []
    emitRecommendations(io)
  }
}

async function getOrCreateSession(socket: IOSocket) {
  const authSessionId = socket.handshake.auth?.sessionId
  const sessionId = typeof authSessionId === "string" && authSessionId.length > 0 ? authSessionId : nanoid()

  const ip =
    (socket.handshake.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    socket.handshake.address ??
    null

  const existing = await prisma.userSession.findUnique({ where: { id: sessionId } })
  if (existing) {
    const role = existing.role === "admin" ? ("admin" as const) : ("guest" as const)
    await prisma.userSession.update({
      where: { id: sessionId },
      data: { ip: ip ?? undefined },
    })
    return { id: existing.id, name: existing.name, role }
  }

  const created = await prisma.userSession.create({
    data: {
      id: sessionId,
      ip: ip ?? undefined,
      role: "guest",
    },
  })
  return { id: created.id, name: created.name, role: "guest" as const }
}

export function registerSocketHandlers(io: IOServer) {
  // Broadcast pairing code + TTL so clients can display a live countdown.
  // (Also ensures clients get the new code when it rotates.)
  setInterval(() => {
    const pairing = getOrRotatePairingCode(pairingCodeTtlMs)
    // Only the host display(s) should ever see the code.
    io.to(HOST_ROOM).emit("admin:pairing", {
      pairingCode: pairing.code,
      pairingCodeTtlMs: pairing.ttlMs,
    })
  }, 1000).unref?.()

  io.on("connection", (socket: IOSocket) => {
    ;(async () => {
      usersState.count += 1
      io.emit("users:count", { count: usersState.count })

      const isHost = isHostClient(socket)
      if (isHost) socket.join(HOST_ROOM)

      const session = await getOrCreateSession(socket)
      let current = session
      socket.data.sessionId = current.id

      socket.emit("state:full", await buildFullState(current, { includePairingCode: isHost }))
      await updateRecommendationsAndAutoplay(io)

      socket.on("me:setName", async ({ name }) => {
        const trimmed = String(name ?? "").trim().slice(0, 32)
        await prisma.userSession.update({
          where: { id: current.id },
          data: { name: trimmed.length ? trimmed : null },
        })
        current = { ...current, name: trimmed.length ? trimmed : null }
        socket.emit("state:full", await buildFullState(current, { includePairingCode: isHost }))
      })

      socket.on("admin:pair", async ({ code }) => {
        const pairing = getOrRotatePairingCode(pairingCodeTtlMs)
        if (!isValidPairingCode(pairing.code, String(code ?? ""))) {
          socket.emit("toast", { type: "error", message: "Invalid pairing code" })
          return
        }

        await prisma.adminGrant.upsert({
          where: { sessionId: current.id },
          update: { revokedAt: null },
          create: { sessionId: current.id },
        })
        await prisma.userSession.update({ where: { id: current.id }, data: { role: "admin" } })
        current = { ...current, role: "admin" }
        socket.emit("admin:status", { role: "admin" })
        socket.emit("toast", { type: "success", message: "Admin enabled" })
        socket.emit("state:full", await buildFullState(current, { includePairingCode: isHost }))
      })

      socket.on("admin:revoke", async () => {
        if (current.role !== "admin") return
        await prisma.adminGrant
          .update({ where: { sessionId: current.id }, data: { revokedAt: new Date() } })
          .catch(() => null)
        await prisma.userSession.update({ where: { id: current.id }, data: { role: "guest" } })
        current = { ...current, role: "guest" }
        socket.emit("admin:status", { role: "guest" })
        socket.emit("toast", { type: "info", message: "Admin disabled" })
        socket.emit("state:full", await buildFullState(current, { includePairingCode: isHost }))
      })

      socket.on("queue:add", async ({ youtubeId }) => {
        try {
          canAddToQueueOrThrow(current.id)
        } catch (e) {
          socket.emit("toast", { type: "error", message: (e as Error).message })
          return
        }

        const raw = String(youtubeId ?? "").trim()
        const idMatch = raw.match(/^[a-zA-Z0-9_-]{11}$/) ? raw : raw.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1] ?? null
        const id = idMatch?.trim() ?? ""
        if (!id) {
          socket.emit("toast", { type: "error", message: "Missing YouTube ID" })
          return
        }

        const last = await prisma.queueItem.findFirst({ orderBy: { position: "desc" }, select: { position: true } })
        const position = (last?.position ?? 0) + 1

        const known = await prisma.songMetadata.findUnique({ where: { youtubeId: id } })
        const provider = getMusicProvider()
        const freshMeta = known ? null : await provider.getMetadata(id).catch(() => null)

        await prisma.queueItem.create({
          data: {
            youtubeId: id,
            title: known?.title ?? freshMeta?.title ?? "Unknown title",
            artist: known?.artist ?? freshMeta?.artist ?? null,
            thumbnailUrl: known?.thumbnailUrl ?? freshMeta?.thumbnailUrl ?? null,
            durationSec: known?.durationSec ?? freshMeta?.durationSec ?? null,
            addedBySessionId: current.id,
            position,
          },
        })

        if (freshMeta) {
          await prisma.songMetadata.upsert({
            where: { youtubeId: id },
            update: {
              title: freshMeta.title,
              artist: freshMeta.artist,
              thumbnailUrl: freshMeta.thumbnailUrl,
              durationSec: freshMeta.durationSec,
            },
            create: {
              youtubeId: id,
              title: freshMeta.title,
              artist: freshMeta.artist,
              thumbnailUrl: freshMeta.thumbnailUrl,
              durationSec: freshMeta.durationSec,
            },
          })
        }

        io.emit("queue:updated", { queue: await fetchQueueDTOs() })
        socket.emit("toast", { type: "success", message: "Added to queue" })

        // If nothing is currently playing, start playback immediately.
        await ensureNowPlayingRow()
        const np = await prisma.nowPlaying.findUnique({ where: { id: 1 } })
        const isLobby = !!(lobbyYoutubeId && np?.youtubeId === lobbyYoutubeId)
        if (!np?.youtubeId || isLobby) {
          await advanceQueueAndBroadcast(io)
        } else {
          await updateRecommendationsAndAutoplay(io)
        }
      })

      socket.on("queue:remove", async ({ queueItemId }) => {
        if (current.role !== "admin") {
          socket.emit("toast", { type: "error", message: "Admin only" })
          return
        }
        const id = String(queueItemId ?? "")
        await prisma.queueItem.delete({ where: { id } }).catch(() => null)

        const items = await prisma.queueItem.findMany({ orderBy: { position: "asc" }, select: { id: true } })
        await prisma.$transaction(
          items.map((item, idx) => prisma.queueItem.update({ where: { id: item.id }, data: { position: idx + 1 } })),
        )

        io.emit("queue:updated", { queue: await fetchQueueDTOs() })
        socket.emit("toast", { type: "success", message: "Removed from queue" })
        await updateRecommendationsAndAutoplay(io)
      })

      socket.on("queue:reorder", async ({ orderedQueueItemIds }) => {
        if (current.role !== "admin") {
          socket.emit("toast", { type: "error", message: "Admin only" })
          return
        }
        const ids = Array.isArray(orderedQueueItemIds) ? orderedQueueItemIds.map(String) : []
        if (!ids.length) return

        await prisma.$transaction(
          ids.map((id, idx) => prisma.queueItem.update({ where: { id }, data: { position: idx + 1 } })),
        )

        io.emit("queue:updated", { queue: await fetchQueueDTOs() })
      })

      socket.on("queue:clear", async () => {
        if (current.role !== "admin") {
          socket.emit("toast", { type: "error", message: "Admin only" })
          return
        }
        await prisma.queueItem.deleteMany()
        io.emit("queue:updated", { queue: [] })
        socket.emit("toast", { type: "success", message: "Queue cleared" })
        await updateRecommendationsAndAutoplay(io)
      })

      socket.on("playback:skip", async () => {
        if (current.role !== "admin") {
          socket.emit("toast", { type: "error", message: "Admin only" })
          return
        }
        await advanceQueueAndBroadcast(io)
      })

      socket.on("playback:pauseToggle", async () => {
        if (current.role !== "admin") {
          socket.emit("toast", { type: "error", message: "Admin only" })
          return
        }
        await ensureNowPlayingRow()
        const row = await prisma.nowPlaying.findUnique({ where: { id: 1 } })
        await prisma.nowPlaying.update({ where: { id: 1 }, data: { isPaused: !(row?.isPaused ?? false) } })
        io.emit("nowPlaying:updated", { nowPlaying: await fetchNowPlayingDTO() })
      })

      socket.on("playback:ended", async ({ youtubeId }) => {
        // Host tells us current track ended; record it then advance.
        await recordPlay(String(youtubeId ?? "")).catch(() => null)
        await advanceQueueAndBroadcast(io)
      })

      socket.on("playback:error", async ({ youtubeId, message }) => {
        // Only advance on real YouTube player error codes (101/150/etc).
        // Client-side integration errors shouldn't clear the queue.
        // eslint-disable-next-line no-console
        console.warn("Playback error:", message)
        const msg = String(message ?? "")
        const yt = String(youtubeId ?? "").trim()
        const isEmbedBlocked =
          msg.includes("YouTube error code: 150") ||
          msg.includes("YouTube error code: 101") ||
          msg.includes("embed blocked")
        if (isEmbedBlocked) {
          io.emit("toast", {
            type: "error",
            message: `Skipped a track that can't be embedded on the host TV.${yt ? ` (${yt})` : ""}`,
          })
        }
        if (msg.startsWith("YouTube error")) {
          await advanceQueueAndBroadcast(io)
        }
      })

      socket.on("disconnect", () => {
        usersState.count = Math.max(0, usersState.count - 1)
        io.emit("users:count", { count: usersState.count })
      })
    })().catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err)
      socket.emit("toast", { type: "error", message: "Server error" })
    })
  })
}

