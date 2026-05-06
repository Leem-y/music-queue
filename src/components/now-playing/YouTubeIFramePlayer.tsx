"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"

type PlayerState = {
  ready: boolean
  currentTime: number
  duration: number
}

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

function loadYouTubeIFrameAPI(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"))
  if (window.YT?.Player) return Promise.resolve(window.YT)

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    if (existing) {
      const t = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(t)
          resolve(window.YT)
        }
      }, 50)
      return
    }

    const tag = document.createElement("script")
    tag.src = "https://www.youtube.com/iframe_api"
    document.body.appendChild(tag)

    window.onYouTubeIframeAPIReady = () => resolve(window.YT)
  })
}

export function YouTubeIFramePlayer(props: {
  youtubeId: string | null
  isPaused: boolean
  /** Queue tracks notify the server on end; lobby loops locally without touching the queue. */
  playbackMode?: "queue" | "lobby"
  onEnded: () => void
  onError: (message?: string) => void
  onReady?: (durationSec: number) => void
}) {
  const { youtubeId, isPaused, playbackMode = "queue", onEnded, onError, onReady } = props

  // Stable across SSR/CSR to avoid hydration mismatches.
  const reactId = useId()
  const containerId = useMemo(() => `yt-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [reactId])
  const playerRef = useRef<any>(null)
  const playbackModeRef = useRef(playbackMode)
  const onEndedRef = useRef(onEnded)
  const onErrorRef = useRef(onError)
  const onReadyRef = useRef(onReady)
  const [unlocked, setUnlocked] = useState(false)
  const [state, setState] = useState<PlayerState>({ ready: false, currentTime: 0, duration: 0 })
  const [lastError, setLastError] = useState<string | null>(null)

  function normalizeId(input: string | null) {
    const id = String(input ?? "").trim()
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
  }

  useEffect(() => {
    playbackModeRef.current = playbackMode
    onEndedRef.current = onEnded
    onErrorRef.current = onError
    onReadyRef.current = onReady
  }, [playbackMode, onEnded, onError, onReady])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const YT = await loadYouTubeIFrameAPI()
      if (cancelled) return

      playerRef.current = new YT.Player(containerId, {
        width: "100%",
        height: "100%",
        videoId: youtubeId ?? undefined,
        playerVars: {
          autoplay: 0,
          controls: 1,
          disablekb: 1,
          fs: 0,
          enablejsapi: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          // Helps avoid "invalid parameter" issues in some environments.
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            setState((s) => ({ ...s, ready: true }))
          },
          onStateChange: (evt: any) => {
            if (evt.data !== YT.PlayerState.ENDED) return
            if (playbackModeRef.current === "lobby") {
              try {
                const p = playerRef.current
                p?.seekTo?.(0, true)
                p?.playVideo?.()
              } catch {
                // ignore
              }
              return
            }
            onEndedRef.current()
          },
          onError: (evt: any) => {
            const code = Number(evt?.data)
            const msg =
              code === 150 || code === 101
                ? `This video can't be played on the host (YouTube embed blocked: ${code}). Try another upload.`
                : `YouTube error code: ${evt?.data}`
            setLastError(msg)
            onErrorRef.current(msg)
          },
        },
      })
    })().catch((e) => {
      const msg = (e as Error).message
      setLastError(msg)
      onErrorRef.current(msg)
    })

    return () => {
      cancelled = true
      try {
        playerRef.current?.destroy?.()
      } catch {
        // ignore
      }
      playerRef.current = null
    }
  }, [containerId])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !state.ready) return
    if (!youtubeId) return

    // YouTube video IDs are 11 chars; avoid calling the API with bad IDs.
    const id = normalizeId(youtubeId)
    if (!id) {
      const msg = `Invalid video id: ${JSON.stringify(String(youtubeId ?? "").trim())}`
      setLastError(msg)
      onErrorRef.current(msg)
      return
    }

    try {
      const startVideo = () => {
        if (typeof player.loadVideoById === "function") {
          player.loadVideoById(id)
        } else if (typeof player.cueVideoById === "function") {
          player.cueVideoById(id)
          player.playVideo?.()
        } else {
          throw new Error("YouTube player did not expose load/cue methods")
        }
      }

      // If the user has already interacted, use loadVideoById to start immediately.
      // Otherwise cue it so it's ready once unlocked.
      if (unlocked) {
        try {
          player.mute?.()
        } catch {
          // ignore
        }
        startVideo()
        // Unmute after the user-gesture unlock.
        setTimeout(() => {
          try {
            player.unMute?.()
          } catch {
            // ignore
          }
        }, 250)
      } else {
        player.cueVideoById(id)
      }
    } catch (e) {
      const msg = (e as Error).message
      setLastError(msg)
      onErrorRef.current((e as Error).message)
    }
  }, [youtubeId, playbackMode, state.ready, unlocked])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !state.ready) return
    try {
      if (isPaused) player.pauseVideo()
      else if (unlocked) player.playVideo()
    } catch {
      // ignore
    }
  }, [isPaused, state.ready, unlocked])

  useEffect(() => {
    if (!state.ready) return
    const t = setInterval(() => {
      const player = playerRef.current
      if (!player?.getCurrentTime) return
      const currentTime = Number(player.getCurrentTime?.() ?? 0)
      const duration = Number(player.getDuration?.() ?? 0)
      setState((s) => ({
        ...s,
        currentTime: Number.isFinite(currentTime) ? currentTime : 0,
        duration: Number.isFinite(duration) ? duration : s.duration,
      }))
      if (duration && onReadyRef.current) onReadyRef.current(Math.floor(duration))
    }, 500)
    return () => clearInterval(t)
  }, [state.ready])

  return (
    <div className="relative h-full w-full">
      <div
        id={containerId}
        className={[
          "absolute inset-0",
          // Slightly fade the iframe to fit the glass aesthetic, but keep it visible for reliable playback.
          unlocked ? "opacity-100" : "opacity-60",
        ].join(" ")}
      />
      {!unlocked ? (
        <button
          className="absolute inset-0 grid place-items-center rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-sm"
          onClick={() => {
            setUnlocked(true)
            try {
              const id = normalizeId(youtubeId)
              if (id) {
                const player = playerRef.current
                try {
                  player?.mute?.()
                } catch {
                  // ignore
                }
                if (typeof player?.loadVideoById === "function") {
                  player.loadVideoById(id)
                } else if (typeof player?.cueVideoById === "function") {
                  player.cueVideoById(id)
                  player.playVideo?.()
                }
                setTimeout(() => {
                  try {
                    player?.unMute?.()
                  } catch {
                    // ignore
                  }
                }, 250)
              } else if (youtubeId) {
                const msg = `Invalid video id: ${JSON.stringify(String(youtubeId ?? "").trim())}`
                setLastError(msg)
                onErrorRef.current(msg)
              } else {
                playerRef.current?.playVideo?.()
              }
            } catch {
              // ignore
            }
          }}
        >
          <div className="rounded-full bg-white px-8 py-4 text-lg font-semibold text-black">
            Tap to start playback
          </div>
        </button>
      ) : null}
      {lastError ? (
        <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-black/60 px-3 py-2 text-xs text-white/80 ring-1 ring-white/10">
          {lastError}
        </div>
      ) : null}
      <div className="sr-only" aria-live="polite">
        {youtubeId ? "Playing" : "Idle"}
      </div>
    </div>
  )
}

