import type { MusicProvider, TrackMetadata } from "@/server/music/providers/MusicProvider"

type SpotifyTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

type SpotifySearchResponse = {
  tracks?: {
    items?: Array<{
      uri?: string
      id?: string
      name?: string
      duration_ms?: number
      artists?: Array<{ name?: string }>
      album?: { images?: Array<{ url?: string; width?: number; height?: number }> }
    }>
  }
}

function spotifyClientId() {
  const v = String(process.env.SPOTIFY_CLIENT_ID ?? "").trim()
  if (!v) throw new Error("Missing SPOTIFY_CLIENT_ID")
  return v
}

function spotifyClientSecret() {
  const v = String(process.env.SPOTIFY_CLIENT_SECRET ?? "").trim()
  if (!v) throw new Error("Missing SPOTIFY_CLIENT_SECRET")
  return v
}

let appTokenCache: { token: string; expiresAtMs: number } | null = null

async function getAppAccessToken(): Promise<string> {
  const now = Date.now()
  if (appTokenCache && appTokenCache.expiresAtMs - now > 15_000) return appTokenCache.token

  const auth = Buffer.from(`${spotifyClientId()}:${spotifyClientSecret()}`).toString("base64")
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  })
  if (!res.ok) throw new Error(`Spotify token error: ${res.status}`)
  const json = (await res.json()) as SpotifyTokenResponse
  appTokenCache = { token: json.access_token, expiresAtMs: Date.now() + json.expires_in * 1000 }
  return json.access_token
}

function bestImageUrl(images: Array<{ url?: string; width?: number; height?: number }> | undefined): string | null {
  const arr = Array.isArray(images) ? images : []
  if (!arr.length) return null
  const sorted = [...arr].sort((a, b) => (b?.width ?? 0) - (a?.width ?? 0))
  return sorted[0]?.url ? String(sorted[0].url) : null
}

type SpotifyTrackItem = NonNullable<NonNullable<SpotifySearchResponse["tracks"]>["items"]>[number]

function normalizeTrack(t: SpotifyTrackItem): TrackMetadata | null {
  const uri = t?.uri ? String(t.uri).trim() : ""
  if (!uri) return null
  const title = String(t?.name ?? "").trim() || "Unknown title"
  const artist = Array.isArray(t?.artists)
    ? (t.artists.map((a: { name?: string }) => a?.name).filter(Boolean).join(", ") || null)
    : null
  const thumbnailUrl = bestImageUrl(t?.album?.images)
  const durationSec = typeof t?.duration_ms === "number" ? Math.max(0, Math.floor(t.duration_ms / 1000)) : null

  return {
    provider: "spotify",
    trackId: uri,
    title,
    artist,
    thumbnailUrl,
    durationSec,
    audioUrl: null,
  }
}

export class SpotifyProvider implements MusicProvider {
  async search(query: string, limit = 12): Promise<TrackMetadata[]> {
    const q = String(query ?? "").trim()
    if (!q) return []

    const token = await getAppAccessToken()
    const url = new URL("https://api.spotify.com/v1/search")
    url.searchParams.set("type", "track")
    url.searchParams.set("q", q)
    url.searchParams.set("limit", String(Math.min(Math.max(1, limit), 24)))

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Spotify search error: ${res.status}`)
    const json = (await res.json()) as SpotifySearchResponse
    const items = Array.isArray(json?.tracks?.items) ? json.tracks.items : []
    const out: TrackMetadata[] = []
    for (const it of items) {
      const m = normalizeTrack(it as any)
      if (!m) continue
      out.push(m)
      if (out.length >= limit) break
    }
    return out
  }

  async getMetadata(trackId: string): Promise<TrackMetadata | null> {
    // trackId is a spotify:track: URI; metadata is best fetched with user token.
    // For now, rely on search/known metadata and keep this as a no-op.
    const tid = String(trackId ?? "").trim()
    if (!tid) return null
    return {
      provider: "spotify",
      trackId: tid,
      title: "Spotify track",
      artist: null,
      thumbnailUrl: null,
      durationSec: null,
      audioUrl: null,
    }
  }
}

