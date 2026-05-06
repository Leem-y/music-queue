import type { MusicProvider, TrackMetadata } from "@/server/music/providers/MusicProvider"

type JamendoTrack = {
  id: string
  name?: string
  artist_name?: string
  duration?: number | string
  image?: string
  album_image?: string
  audiodownload_allowed?: boolean
}

type JamendoTracksResponse = {
  results?: JamendoTrack[]
}

function jamendoClientId(): string {
  const id = String(process.env.JAMENDO_CLIENT_ID ?? "").trim()
  if (!id) throw new Error("Missing JAMENDO_CLIENT_ID")
  return id
}

function toIntSeconds(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v)
  if (!Number.isFinite(n)) return null
  const s = Math.max(0, Math.floor(n))
  return s > 0 ? s : null
}

function streamUrl(trackId: string): string {
  const id = jamendoClientId()
  const tid = String(trackId ?? "").trim()
  // "tracks/file" redirects to the actual file; "action=stream" hints streaming usage.
  return `https://api.jamendo.com/v3.0/tracks/file/?client_id=${encodeURIComponent(id)}&id=${encodeURIComponent(
    tid,
  )}&action=stream&audioformat=mp32`
}

function normalizeTrack(t: JamendoTrack): TrackMetadata | null {
  const trackId = String(t?.id ?? "").trim()
  if (!trackId) return null
  if (t.audiodownload_allowed === false) return null

  const title = String(t?.name ?? "").trim() || "Unknown title"
  const artist = t?.artist_name ? String(t.artist_name).trim() || null : null
  const thumbnailUrl = (t?.image ?? t?.album_image ?? null) ? String(t.image ?? t.album_image) : null
  const durationSec = toIntSeconds(t?.duration)

  return {
    provider: "jamendo",
    trackId,
    title,
    artist,
    thumbnailUrl,
    durationSec,
    audioUrl: streamUrl(trackId),
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": "music-queue" } })
  if (!res.ok) throw new Error(`Jamendo API error: ${res.status}`)
  return (await res.json()) as T
}

export class JamendoProvider implements MusicProvider {
  async search(query: string, limit = 12): Promise<TrackMetadata[]> {
    const q = String(query ?? "").trim()
    if (!q) return []

    const id = jamendoClientId()
    const url =
      `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(id)}` +
      `&format=json&limit=${encodeURIComponent(String(Math.min(Math.max(1, limit), 24)))}` +
      `&namesearch=${encodeURIComponent(q)}` +
      `&audioformat=mp32`

    const json = await fetchJson<JamendoTracksResponse>(url)
    const tracks = Array.isArray(json?.results) ? json.results : []

    const out: TrackMetadata[] = []
    for (const t of tracks) {
      const m = normalizeTrack(t)
      if (!m) continue
      out.push(m)
      if (out.length >= limit) break
    }
    return out
  }

  async getMetadata(trackId: string): Promise<TrackMetadata | null> {
    const tid = String(trackId ?? "").trim()
    if (!tid) return null

    const id = jamendoClientId()
    const url =
      `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(id)}` +
      `&format=json&limit=1&id=${encodeURIComponent(tid)}` +
      `&audioformat=mp32`

    const json = await fetchJson<JamendoTracksResponse>(url)
    const t = Array.isArray(json?.results) ? json.results[0] : null
    return t ? normalizeTrack(t) : null
  }
}

