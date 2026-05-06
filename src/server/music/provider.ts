import type { MusicProvider } from "@/server/music/providers/MusicProvider"
import { JamendoProvider } from "@/server/music/providers/jamendo/JamendoProvider"
import { SpotifyProvider } from "@/server/music/providers/spotify/SpotifyProvider"

const globalForProvider = globalThis as unknown as { musicProvider?: MusicProvider }

export function getMusicProvider(): MusicProvider {
  if (!globalForProvider.musicProvider) {
    const prefer = String(process.env.MUSIC_PROVIDER ?? "").trim().toLowerCase()
    const hasSpotify = !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET)
    if (prefer === "spotify" || (prefer !== "jamendo" && hasSpotify)) {
      globalForProvider.musicProvider = new SpotifyProvider()
    } else {
      globalForProvider.musicProvider = new JamendoProvider()
    }
  }
  return globalForProvider.musicProvider
}

