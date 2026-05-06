"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { GripVertical, Pause, Play, Shield, SkipForward, Users, X } from "lucide-react"
import { toast } from "sonner"

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { useSocketSync } from "@/client/useSocketSync"
import { useSecondTick } from "@/client/useSecondTick"
import { getSocket } from "@/client/socket"
import { useAppStore } from "@/client/store"
import { AudioPlayer } from "@/components/now-playing/AudioPlayer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

function formatDuration(sec: number | null) {
  if (!sec || !Number.isFinite(sec)) return ""
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`
}

export default function HostPage() {
  useSocketSync()
  useSecondTick()

  const usersCount = useAppStore((s) => s.usersCount)
  const nowPlaying = useAppStore((s) => s.nowPlaying)
  const queue = useAppStore((s) => s.queue)
  const role = useAppStore((s) => s.role)
  const sessionId = useAppStore((s) => s.sessionId)
  const pairingCode = useAppStore((s) => s.pairingCode)
  const pairingCodeTtlMs = useAppStore((s) => s.pairingCodeTtlMs)
  const recommendations = useAppStore((s) => s.recommendations)

  const socket = useMemo(() => getSocket(), [])
  const [pairDraft, setPairDraft] = useState("")

  const [spotifyLoggedIn, setSpotifyLoggedIn] = useState<boolean>(false)
  const [spotifyUserLabel, setSpotifyUserLabel] = useState<string | null>(null)
  const [spotifyDevices, setSpotifyDevices] = useState<Array<{ id?: string; name?: string; type?: string; is_active?: boolean }>>([])
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null)
  const [spotifyPlayback, setSpotifyPlayback] = useState<any>(null)

  async function spotifyGet<T>(path: string): Promise<T | null> {
    if (!sessionId) return null
    const res = await fetch(path, { headers: { "x-mq-session-id": sessionId } }).catch(() => null)
    if (!res || !res.ok) return null
    return (await res.json()) as T
  }

  async function spotifyPost<T>(path: string, body: unknown): Promise<T | null> {
    if (!sessionId) return null
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mq-session-id": sessionId },
      body: JSON.stringify(body),
    }).catch(() => null)
    if (!res || !res.ok) return null
    return (await res.json()) as T
  }

  useEffect(() => {
    if (role !== "admin") return
    if (!sessionId) return

    let cancelled = false

    async function refresh() {
      const status = await spotifyGet<{
        loggedIn: boolean
        user: { displayName: string | null; email: string | null; deviceId: string | null } | null
      }>("/api/spotify/status")

      if (!status || cancelled) return
      setSpotifyLoggedIn(!!status.loggedIn)
      const label = status.user?.displayName ?? status.user?.email ?? null
      setSpotifyUserLabel(label)
      setSpotifyDeviceId(status.user?.deviceId ?? null)

      if (status.loggedIn) {
        const devices = await spotifyGet<{ devices: any[] }>("/api/spotify/devices")
        if (devices && !cancelled) setSpotifyDevices(Array.isArray(devices.devices) ? devices.devices : [])

        const pb = await spotifyGet<{ playback: any }>("/api/spotify/playback")
        if (pb && !cancelled) setSpotifyPlayback(pb.playback ?? null)
      } else {
        setSpotifyDevices([])
        setSpotifyPlayback(null)
      }
    }

    refresh().catch(() => null)
    const t = window.setInterval(() => refresh().catch(() => null), 5000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [role, sessionId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Basic local progress bar (host-side). For now we only display duration; currentTime comes from the player component.
  const [playerDuration, setPlayerDuration] = useState<number>(0)
  const progress = nowPlaying.durationSec ? 0 : 0

  const nextUp = queue[0] ?? null
  const isLobby = nowPlaying.isLobby
  const isIdle = !nowPlaying.trackId || isLobby
  const playbackSrc = nowPlaying.audioUrl
  const playbackMode: "queue" | "lobby" = isIdle ? "lobby" : "queue"
  const heroThumbnailUrl = nowPlaying.thumbnailUrl
  const nowProviderLabel = nowPlaying.provider === "spotify" ? "Spotify Connect" : "Jamendo"

  const displayTitle = isLobby
    ? "Lobby"
    : (nowPlaying.title ?? (nowPlaying.trackId ? "Playing" : "Waiting for songs"))
  const displayArtist = isLobby ? "Waiting for someone to queue a song" : (nowPlaying.artist ?? "")

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isLobby) return
      if (role !== "admin") return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === "Space") {
        e.preventDefault()
        socket?.emit("playback:pauseToggle")
      }
      if (e.code === "ArrowRight") {
        e.preventDefault()
        socket?.emit("playback:skip")
      }
      if (e.code === "KeyC") {
        e.preventDefault()
        socket?.emit("queue:clear")
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isLobby, role, socket])

  return (
    <div className="min-h-full flex-1 bg-black text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {heroThumbnailUrl ? (
          <Image
            src={heroThumbnailUrl}
            alt=""
            fill
            className="object-cover opacity-20 blur-3xl scale-110"
            priority
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black to-black" />
      </div>

      <main className="mx-auto w-full max-w-[1600px] px-6 py-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-semibold tracking-tight">Now Playing</div>
            <Badge variant="secondary" className="bg-white/10 text-white">
              <Users className="mr-2 h-4 w-4" />
              {usersCount}
            </Badge>
            {role === "admin" ? (
              <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20">
                <Shield className="mr-2 h-4 w-4" />
                Admin
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2">
              <div className="text-xs text-white/60">Pairing code</div>
              <div className="font-mono text-xl tracking-widest">{pairingCode}</div>
              <div className="text-xs text-white/50">
                rotates in {Math.max(0, Math.ceil(pairingCodeTtlMs / 1000))}s
              </div>
            </div>

            <Dialog>
              <DialogTrigger
                render={
                  <Button className="rounded-full bg-white text-black hover:bg-white/90">Enter code</Button>
                }
              >
                Enter code
              </DialogTrigger>
              <DialogContent className="bg-zinc-950 border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle>Admin pairing</DialogTitle>
                  <DialogDescription className="text-white/60">
                    Enter the code shown on the host screen.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2">
                  <Input
                    value={pairDraft}
                    onChange={(e) => setPairDraft(e.target.value)}
                    placeholder="000000"
                    className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  />
                  <Button
                    className="h-11 rounded-full bg-white text-black hover:bg-white/90"
                    onClick={() => socket?.emit("admin:pair", { code: pairDraft })}
                  >
                    Pair
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Link href="/" className="text-sm text-white/70 hover:text-white transition-colors">
              Guest view
            </Link>

            {role === "admin" ? (
              <Button
                variant="secondary"
                className="h-10 rounded-full bg-white/10 text-white hover:bg-white/15"
                onClick={() => socket?.emit("queue:clear")}
              >
                Clear queue
              </Button>
            ) : null}

            {role === "admin" ? (
              <Button
                variant="secondary"
                className="h-10 rounded-full bg-white/10 text-white hover:bg-white/15"
                onClick={() => socket?.emit("admin:revoke")}
              >
                Disable admin
              </Button>
            ) : null}
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-6">
            {role === "admin" ? (
              <Card className="border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-white/60">Spotify Connect</div>
                    <div className="text-lg font-semibold">
                      {spotifyLoggedIn ? (spotifyUserLabel ? `Connected as ${spotifyUserLabel}` : "Connected") : "Not connected"}
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                      {spotifyLoggedIn
                        ? spotifyDeviceId
                          ? `Device selected: ${spotifyDeviceId}`
                          : "Select a device to play to"
                        : "Connect Spotify to enable Spotify playback"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!spotifyLoggedIn ? (
                      <Button
                        className="rounded-full bg-white text-black hover:bg-white/90"
                        disabled={!sessionId}
                        onClick={() => {
                          if (!sessionId) return
                          window.location.href = `/api/spotify/login?sessionId=${encodeURIComponent(sessionId)}`
                        }}
                      >
                        Connect Spotify
                      </Button>
                    ) : null}
                  </div>
                </div>

                {spotifyLoggedIn ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="text-sm font-medium">Devices</div>
                      <div className="mt-2 space-y-2">
                        {spotifyDevices.length ? (
                          spotifyDevices.map((d) => (
                            <button
                              key={String(d.id ?? d.name ?? Math.random())}
                              className={[
                                "w-full text-left rounded-xl px-3 py-2 ring-1 transition-colors",
                                d.id && d.id === spotifyDeviceId
                                  ? "bg-emerald-500/10 ring-emerald-400/30"
                                  : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.04]",
                              ].join(" ")}
                              onClick={() => {
                                if (!d.id) return
                                spotifyPost("/api/spotify/device", { deviceId: d.id })
                                  .then(() => setSpotifyDeviceId(String(d.id)))
                                  .catch(() => null)
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{String(d.name ?? "Device")}</div>
                                  <div className="truncate text-xs text-white/60">{String(d.type ?? "")}</div>
                                </div>
                                <div className="text-xs text-white/50">{d.is_active ? "Active" : ""}</div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="text-sm text-white/60">
                            Open Spotify on a device on the same network (TV, laptop, speaker) to make it appear here.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="text-sm font-medium">Playback</div>
                      <div className="mt-2 text-sm text-white/70">
                        {spotifyPlayback?.item?.name ? (
                          <div>
                            <div className="font-semibold truncate">{String(spotifyPlayback.item.name)}</div>
                            <div className="text-white/60 truncate">
                              {Array.isArray(spotifyPlayback.item.artists)
                                ? spotifyPlayback.item.artists.map((a: any) => a?.name).filter(Boolean).join(", ")
                                : ""}
                            </div>
                            <div className="mt-1 text-xs text-white/50">
                              {spotifyPlayback.is_playing ? "Playing" : "Paused"}
                            </div>
                          </div>
                        ) : (
                          <div className="text-white/60">No active Spotify playback.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </Card>
            ) : null}

            <Card className="border-white/10 bg-white/[0.03] p-6">
              {/* Keep DOM structure stable to avoid unmounting the player (prevents blinking). */}
              <div className={isIdle && recommendations.items.length ? "mb-6" : "mb-0"}>
                {isIdle && recommendations.items.length ? (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm text-white/60">Queue is empty</div>
                        <div className="text-lg font-semibold">Recommendations</div>
                      </div>
                      <div className="text-right text-xs text-white/50 max-w-[14rem]">
                        {isLobby ? "Lobby music is on the TV. Add a song from a guest phone." : "Add a song from a guest device."}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {recommendations.items.slice(0, 6).map((r) => (
                        <div
                          key={`${r.provider}:${r.trackId}`}
                          className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-white/5 transition-colors"
                        >
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
                            {r.thumbnailUrl ? (
                              <Image src={r.thumbnailUrl} alt="" fill className="object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{r.title}</div>
                            <div className="truncate text-sm text-white/60">
                              {r.artist ?? ""}
                              {" • "}
                              {r.reason === "most_played" ? "Most played" : "Recently popular"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-6 md:grid-cols-[360px_1fr]">
                <div className="relative aspect-square overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10">
                  {heroThumbnailUrl ? (
                    <Image src={heroThumbnailUrl} alt="" fill className="object-cover" priority />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-white/40">No track</div>
                  )}
                </div>

                <div className="min-w-0 flex flex-col">
                  <div className="text-sm text-white/60">Playing from {nowProviderLabel}</div>
                  <div className="mt-2 text-4xl font-semibold tracking-tight leading-tight truncate">{displayTitle}</div>
                  <div className="mt-2 text-lg text-white/70 truncate">{displayArtist}</div>

                  <div className="mt-6 space-y-2">
                    <Progress value={progress} className="h-2 bg-white/10" />
                    <div className="flex justify-between text-sm text-white/50 tabular-nums">
                      <div>—</div>
                      <div>{formatDuration(nowPlaying.durationSec ?? (playerDuration || null))}</div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center gap-3">
                    <Button
                      className="h-12 rounded-full bg-white text-black hover:bg-white/90"
                      onClick={() => socket?.emit("playback:pauseToggle")}
                      disabled={role !== "admin" || isLobby}
                    >
                      {nowPlaying.isPaused ? <Play className="mr-2 h-5 w-5" /> : <Pause className="mr-2 h-5 w-5" />}
                      {nowPlaying.isPaused ? "Resume" : "Pause"}
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-12 rounded-full bg-white/10 text-white hover:bg-white/15"
                      onClick={() => socket?.emit("playback:skip")}
                      disabled={role !== "admin" || isLobby}
                    >
                      <SkipForward className="mr-2 h-5 w-5" />
                      Skip
                    </Button>
                    {role !== "admin" ? (
                      <div className="text-sm text-white/60">Pair to enable controls.</div>
                    ) : isLobby ? (
                      <div className="text-sm text-white/60">Queue controls apply to party tracks only.</div>
                    ) : null}
                  </div>

                  <div className="mt-6 rounded-3xl overflow-hidden bg-black/40 ring-1 ring-white/10">
                    <div className="aspect-video">
                      {nowPlaying.provider === "spotify" ? (
                        <div className="absolute inset-0 grid place-items-center text-center px-6">
                          <div>
                            <div className="text-sm text-white/60">Spotify Connect playback</div>
                            <div className="mt-2 text-lg font-semibold">Playing on your selected device</div>
                            <div className="mt-2 text-sm text-white/60">
                              Use the device selector above, or open Spotify to choose where it plays.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <AudioPlayer
                          src={playbackSrc}
                          isPaused={playbackMode === "lobby" ? false : nowPlaying.isPaused}
                          playbackMode={playbackMode}
                          onEnded={() => {
                            if (playbackMode === "lobby") return
                            if (!nowPlaying.provider || !nowPlaying.trackId) return
                            socket?.emit("playback:ended", { provider: nowPlaying.provider, trackId: nowPlaying.trackId })
                          }}
                          onError={(message) => {
                            toast.error(message ?? "Audio playback error")
                            if (playbackMode === "lobby") return
                            if (!nowPlaying.provider || !nowPlaying.trackId) return
                            socket?.emit("playback:error", { provider: nowPlaying.provider, trackId: nowPlaying.trackId, message })
                          }}
                          onReady={(d) => setPlayerDuration(d)}
                        />
                      )}
                    </div>
                    <div className="px-3 py-2 text-xs text-white/50 font-mono">
                      track={JSON.stringify(nowPlaying.provider && nowPlaying.trackId ? `${nowPlaying.provider}:${nowPlaying.trackId}` : null)}
                      {isLobby ? " · mode=lobby" : ""}
                    </div>
                  </div>
                </div>
              </div>

              {nextUp ? (
                <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="text-sm text-white/60">Next up</div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
                      {nextUp.thumbnailUrl ? <Image src={nextUp.thumbnailUrl} alt="" fill className="object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-lg font-semibold">{nextUp.title}</div>
                      <div className="truncate text-sm text-white/60">{nextUp.artist ?? ""}</div>
                    </div>
                    {nextUp.durationSec ? (
                      <Badge variant="secondary" className="bg-white/10 text-white">
                        {formatDuration(nextUp.durationSec)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </Card>
          </section>

          <section>
            <Card className="border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <div className="text-xl font-semibold tracking-tight">Queue</div>
                <Badge variant="secondary" className="bg-white/10 text-white">
                  {queue.length}
                </Badge>
              </div>
              <Separator className="my-4 bg-white/10" />
              <ScrollArea className="h-[820px] pr-2">
                <div className="space-y-2">
                  {queue.length ? (
                    role === "admin" ? (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(evt) => {
                          const activeId = String(evt.active.id)
                          const overId = evt.over ? String(evt.over.id) : null
                          if (!overId || activeId === overId) return

                          const oldIndex = queue.findIndex((q) => q.id === activeId)
                          const newIndex = queue.findIndex((q) => q.id === overId)
                          if (oldIndex < 0 || newIndex < 0) return

                          const moved = arrayMove(queue, oldIndex, newIndex)
                          socket?.emit("queue:reorder", { orderedQueueItemIds: moved.map((m) => m.id) })
                        }}
                      >
                        <SortableContext items={queue.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                          {queue.map((item, idx) => (
                            <SortableQueueRow
                              key={item.id}
                              id={item.id}
                              index={idx}
                              title={item.title}
                              artist={item.artist}
                              addedByName={item.addedByName}
                              thumbnailUrl={item.thumbnailUrl}
                              durationSec={item.durationSec}
                              onRemove={() => socket?.emit("queue:remove", { queueItemId: item.id })}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    ) : (
                      queue.map((item, idx) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-white/5 transition-colors"
                        >
                          <div className="w-10 text-right tabular-nums text-white/50">{idx + 1}</div>
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
                            {item.thumbnailUrl ? (
                              <Image src={item.thumbnailUrl} alt="" fill className="object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{item.title}</div>
                            <div className="truncate text-sm text-white/60">
                              {item.artist ?? ""}
                              {item.addedByName ? ` • ${item.addedByName}` : ""}
                            </div>
                          </div>
                          {item.durationSec ? (
                            <Badge variant="secondary" className="bg-white/10 text-white">
                              {formatDuration(item.durationSec)}
                            </Badge>
                          ) : null}
                        </div>
                      ))
                    )
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/60">
                      No songs queued. Guests can add songs from the guest view.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Card>
          </section>
        </div>
      </main>
    </div>
  )
}

function SortableQueueRow(props: {
  id: string
  index: number
  title: string
  artist: string | null
  addedByName: string | null
  thumbnailUrl: string | null
  durationSec: number | null
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors ring-1 ring-transparent",
        isDragging ? "bg-white/10 ring-white/10" : "hover:bg-white/5",
      ].join(" ")}
    >
      <button
        className="w-10 flex items-center justify-end text-white/50 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
        {props.thumbnailUrl ? <Image src={props.thumbnailUrl} alt="" fill className="object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          <span className="text-white/50 tabular-nums mr-2">{props.index + 1}</span>
          {props.title}
        </div>
        <div className="truncate text-sm text-white/60">
          {props.artist ?? ""}
          {props.addedByName ? ` • ${props.addedByName}` : ""}
        </div>
      </div>
      {props.durationSec ? (
        <Badge variant="secondary" className="bg-white/10 text-white">
          {formatDuration(props.durationSec)}
        </Badge>
      ) : null}
      <Button
        variant="secondary"
        className="h-10 w-10 p-0 rounded-full bg-white/10 text-white hover:bg-white/15"
        onClick={props.onRemove}
        aria-label="Remove"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

