import { Innertube } from "youtubei.js"

import type { MusicProvider, TrackMetadata } from "@/server/music/providers/MusicProvider"

function normalizeYouTubeId(input: unknown): string | null {
  if (!input) return null

  // youtubei.js sometimes returns IDs as strings, objects, or URLs.
  const raw =
    typeof input === "string"
      ? input
      : typeof (input as any)?.id === "string"
        ? (input as any).id
        : typeof (input as any)?.videoId === "string"
          ? (input as any).videoId
          : typeof (input as any)?.video_id === "string"
            ? (input as any).video_id
            : null

  if (!raw) return null

  // If it's a full URL, extract v= param.
  const s = raw.trim()
  try {
    if (s.startsWith("http://") || s.startsWith("https://")) {
      const u = new URL(s)
      const v = u.searchParams.get("v")
      if (v) return normalizeYouTubeId(v)
    }
  } catch {
    // ignore
  }

  // Sometimes returned as "watch?v=..." or "v=..."
  const match = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (match?.[1]) return match[1]

  // Plain ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  return null
}

function firstText(x: any): string | null {
  if (!x) return null
  if (typeof x === "string") return x
  if (typeof x?.text === "string") return x.text
  if (Array.isArray(x?.runs)) return x.runs.map((r: any) => r?.text).filter(Boolean).join("")
  return null
}

function bestThumbUrl(thumbnails: any): string | null {
  const arr: any[] =
    Array.isArray(thumbnails) ? thumbnails : Array.isArray(thumbnails?.thumbnails) ? thumbnails.thumbnails : []
  if (!arr.length) return null
  const sorted = [...arr].sort((a, b) => (b?.width ?? 0) - (a?.width ?? 0))
  return sorted[0]?.url ?? null
}

function durationToSeconds(d: any): number | null {
  if (typeof d === "number") return Number.isFinite(d) ? d : null
  const s = firstText(d)
  if (!s) return null
  // Format commonly "3:45" or "1:02:03"
  const parts = s.split(":").map((p) => Number(p))
  if (parts.some((p) => !Number.isFinite(p))) return null
  return parts.reduce((acc, v) => acc * 60 + v, 0)
}

function normalizeFromVideoLike(v: any): TrackMetadata | null {
  const youtubeId = normalizeYouTubeId(v?.id ?? v?.video_id ?? v?.videoId ?? v?.url ?? v?.link)
  if (!youtubeId) return null
  const title = firstText(v?.title) ?? firstText(v?.name) ?? "Unknown title"
  const artist = firstText(v?.author?.name) ?? firstText(v?.channel?.name) ?? firstText(v?.uploader?.name) ?? null
  const thumbnailUrl = bestThumbUrl(v?.thumbnails ?? v?.thumbnail)
  const durationSec = durationToSeconds(v?.duration ?? v?.lengthText ?? v?.length)

  return { youtubeId, title, artist, thumbnailUrl, durationSec }
}

export class YouTubeProvider implements MusicProvider {
  private yt: any

  private async getClient() {
    if (this.yt) return this.yt
    this.yt = await Innertube.create()
    return this.yt
  }

  async search(query: string, limit = 12): Promise<TrackMetadata[]> {
    const q = String(query ?? "").trim()
    if (!q) return []

    const yt = await this.getClient()
    const res: any = await yt.search(q, { type: "video" })

    const candidates: any[] =
      (Array.isArray(res?.videos) ? res.videos : null) ??
      (Array.isArray(res?.results) ? res.results : null) ??
      (Array.isArray(res?.items) ? res.items : null) ??
      []

    const out: TrackMetadata[] = []
    for (const c of candidates) {
      const m = normalizeFromVideoLike(c)
      if (!m) continue
      out.push(m)
      if (out.length >= limit) break
    }
    return out
  }

  async getMetadata(youtubeId: string): Promise<TrackMetadata | null> {
    const id = normalizeYouTubeId(youtubeId)
    if (!id) return null

    const yt = await this.getClient()
    const info: any = await yt.getInfo(id)

    const basic = info?.basic_info ?? info?.basicInfo ?? info
    const fromBasic = normalizeFromVideoLike({
      id,
      title: basic?.title,
      author: { name: basic?.author ?? basic?.channel?.name },
      thumbnails: basic?.thumbnail ?? basic?.thumbnails,
      duration: basic?.duration ?? basic?.durationText ?? basic?.lengthText,
    })

    return fromBasic
  }
}

