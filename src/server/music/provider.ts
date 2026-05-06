import type { MusicProvider } from "@/server/music/providers/MusicProvider"
import { YouTubeProvider } from "@/server/music/providers/youtube/YouTubeProvider"

const globalForProvider = globalThis as unknown as { musicProvider?: MusicProvider }

export function getMusicProvider(): MusicProvider {
  if (!globalForProvider.musicProvider) {
    globalForProvider.musicProvider = new YouTubeProvider()
  }
  return globalForProvider.musicProvider
}

