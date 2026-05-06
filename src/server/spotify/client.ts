export type SpotifyMe = {
  id?: string
  email?: string
  display_name?: string
}

export type SpotifyDevice = {
  id?: string
  is_active?: boolean
  is_restricted?: boolean
  name?: string
  type?: string
  volume_percent?: number
}

export type SpotifyDevicesResponse = {
  devices?: SpotifyDevice[]
}

export type SpotifyPlaybackItem = {
  uri?: string
  id?: string
  name?: string
  duration_ms?: number
  artists?: Array<{ name?: string }>
  album?: { images?: Array<{ url?: string; width?: number; height?: number }> }
}

export type SpotifyPlaybackState = {
  is_playing?: boolean
  progress_ms?: number
  item?: SpotifyPlaybackItem | null
  currently_playing_type?: string
  device?: SpotifyDevice | null
}

async function spotifyFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Spotify API error: ${res.status} ${text}`)
  return (text ? (JSON.parse(text) as T) : ({} as T))
}

export async function spotifyGetMe(accessToken: string) {
  return await spotifyFetch<SpotifyMe>("/me", accessToken)
}

export async function spotifyGetDevices(accessToken: string) {
  return await spotifyFetch<SpotifyDevicesResponse>("/me/player/devices", accessToken)
}

export async function spotifyGetPlayback(accessToken: string) {
  // can 204 when no active playback
  const res = await fetch("https://api.spotify.com/v1/me/player", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 204) return null
  const text = await res.text()
  if (!res.ok) throw new Error(`Spotify API error: ${res.status} ${text}`)
  return (text ? (JSON.parse(text) as SpotifyPlaybackState) : null) as SpotifyPlaybackState | null
}

export async function spotifyPlay(args: { accessToken: string; deviceId?: string | null; uris: string[] }) {
  const url = new URL("https://api.spotify.com/v1/me/player/play")
  if (args.deviceId) url.searchParams.set("device_id", args.deviceId)
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: args.uris }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Spotify play error: ${res.status} ${text}`)
}

export async function spotifyPause(args: { accessToken: string; deviceId?: string | null }) {
  const url = new URL("https://api.spotify.com/v1/me/player/pause")
  if (args.deviceId) url.searchParams.set("device_id", args.deviceId)
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: { Authorization: `Bearer ${args.accessToken}` },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Spotify pause error: ${res.status} ${text}`)
}

export async function spotifyNext(args: { accessToken: string; deviceId?: string | null }) {
  const url = new URL("https://api.spotify.com/v1/me/player/next")
  if (args.deviceId) url.searchParams.set("device_id", args.deviceId)
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${args.accessToken}` },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Spotify next error: ${res.status} ${text}`)
}

export async function spotifyTransfer(args: { accessToken: string; deviceId: string; play?: boolean }) {
  const res = await fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ device_ids: [args.deviceId], play: args.play ?? true }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Spotify transfer error: ${res.status} ${text}`)
}

