import type { MusicProvider } from "@/server/music/providers/MusicProvider"
import { JamendoProvider } from "@/server/music/providers/jamendo/JamendoProvider"

const globalForProvider = globalThis as unknown as { musicProvider?: MusicProvider }

export function getMusicProvider(): MusicProvider {
  if (!globalForProvider.musicProvider) {
    globalForProvider.musicProvider = new JamendoProvider()
  }
  return globalForProvider.musicProvider
}

