"use client"

import { useEffect, useMemo, useRef, useState } from "react"

function makeFallbackWavUrl(): string {
  // Tiny procedural "public domain" loop: 2 seconds of a soft sine tone.
  // Keeps this repo binary-free while guaranteeing a local fallback.
  const sampleRate = 44100
  const durationSec = 2
  const frames = sampleRate * durationSec
  const freq = 220
  const amp = 0.06

  const pcm = new Int16Array(frames)
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate
    const x = Math.sin(2 * Math.PI * freq * t)
    pcm[i] = Math.max(-1, Math.min(1, x * amp)) * 0x7fff
  }

  // WAV header (PCM 16-bit mono)
  const bytesPerSample = 2
  const dataSize = pcm.length * bytesPerSample
  const headerSize = 44
  const buf = new ArrayBuffer(headerSize + dataSize)
  const dv = new DataView(buf)

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i))
  }
  writeStr(0, "RIFF")
  dv.setUint32(4, 36 + dataSize, true)
  writeStr(8, "WAVE")
  writeStr(12, "fmt ")
  dv.setUint32(16, 16, true) // PCM fmt chunk size
  dv.setUint16(20, 1, true) // PCM format
  dv.setUint16(22, 1, true) // mono
  dv.setUint32(24, sampleRate, true)
  dv.setUint32(28, sampleRate * bytesPerSample, true) // byte rate
  dv.setUint16(32, bytesPerSample, true) // block align
  dv.setUint16(34, 16, true) // bits per sample
  writeStr(36, "data")
  dv.setUint32(40, dataSize, true)

  // PCM data
  let o = 44
  for (let i = 0; i < pcm.length; i++, o += 2) dv.setInt16(o, pcm[i]!, true)

  const blob = new Blob([buf], { type: "audio/wav" })
  return URL.createObjectURL(blob)
}

export function AudioPlayer(props: {
  src: string | null
  isPaused: boolean
  playbackMode?: "queue" | "lobby"
  onEnded: () => void
  onError: (message?: string) => void
  onReady?: (durationSec: number) => void
}) {
  const { src, isPaused, playbackMode = "queue", onEnded, onError, onReady } = props

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const fallbackSrc = useMemo(() => makeFallbackWavUrl(), [])
  const effectiveSrc = src ?? (playbackMode === "lobby" ? fallbackSrc : null)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return

    const onEndedLocal = () => {
      if (playbackMode === "lobby") {
        try {
          a.currentTime = 0
          void a.play().catch(() => null)
        } catch {
          // ignore
        }
        return
      }
      onEnded()
    }

    const onErrorLocal = () => {
      const msg = "Audio playback error"
      setLastError(msg)
      onError(msg)
    }

    const onLoaded = () => {
      setLastError(null)
      setAutoplayBlocked(false)
      if (onReady && Number.isFinite(a.duration) && a.duration > 0) onReady(Math.floor(a.duration))
    }

    a.addEventListener("ended", onEndedLocal)
    a.addEventListener("error", onErrorLocal)
    a.addEventListener("loadedmetadata", onLoaded)
    return () => {
      a.removeEventListener("ended", onEndedLocal)
      a.removeEventListener("error", onErrorLocal)
      a.removeEventListener("loadedmetadata", onLoaded)
    }
  }, [onEnded, onError, onReady, playbackMode])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (!effectiveSrc) return

    // Ensure the element sees the new src immediately.
    a.load()
    if (!unlocked) return
    if (isPaused) return

    void a
      .play()
      .then(() => {
        setAutoplayBlocked(false)
      })
      .catch((e) => {
        setAutoplayBlocked(true)
        setLastError((e as Error)?.message ?? "Autoplay blocked")
      })
  }, [effectiveSrc, unlocked, isPaused])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (!unlocked) return
    try {
      if (isPaused) a.pause()
      else void a.play().catch(() => null)
    } catch {
      // ignore
    }
  }, [isPaused, unlocked])

  return (
    <div className="relative h-full w-full">
      <audio ref={audioRef} src={effectiveSrc ?? undefined} preload="auto" />

      {!unlocked ? (
        <button
          className="absolute inset-0 grid place-items-center rounded-3xl bg-white/5 ring-1 ring-white/10 backdrop-blur-sm"
          onClick={() => {
            setUnlocked(true)
            setAutoplayBlocked(false)
            setLastError(null)
            try {
              const a = audioRef.current
              if (a) void a.play().catch(() => setAutoplayBlocked(true))
            } catch {
              setAutoplayBlocked(true)
            }
          }}
        >
          <div className="rounded-full bg-white px-8 py-4 text-lg font-semibold text-black">
            {autoplayBlocked ? "Tap to enable audio" : "Tap to start playback"}
          </div>
        </button>
      ) : null}

      {lastError ? (
        <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-black/60 px-3 py-2 text-xs text-white/80 ring-1 ring-white/10">
          {lastError}
        </div>
      ) : null}
    </div>
  )
}

