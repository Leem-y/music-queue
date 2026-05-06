import { prisma } from "@/server/db"

async function main() {
  await prisma.nowPlaying.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, isPaused: false },
  })

  const seedSongs = [
    {
      youtubeId: "dQw4w9WgXcQ",
      title: "Never Gonna Give You Up",
      artist: "Rick Astley",
      durationSec: 213,
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      playCount: 12,
    },
    {
      youtubeId: "3JZ4pnNtyxQ",
      title: "Uptown Funk (feat. Bruno Mars)",
      artist: "Mark Ronson",
      durationSec: 270,
      thumbnailUrl: "https://i.ytimg.com/vi/3JZ4pnNtyxQ/hqdefault.jpg",
      playCount: 7,
    },
    {
      youtubeId: "kJQP7kiw5Fk",
      title: "Despacito",
      artist: "Luis Fonsi",
      durationSec: 282,
      thumbnailUrl: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
      playCount: 5,
    },
  ] as const

  for (const s of seedSongs) {
    await prisma.songMetadata.upsert({
      where: { youtubeId: s.youtubeId },
      update: {
        title: s.title,
        artist: s.artist,
        durationSec: s.durationSec,
        thumbnailUrl: s.thumbnailUrl,
        playCount: s.playCount,
      },
      create: {
        youtubeId: s.youtubeId,
        title: s.title,
        artist: s.artist,
        durationSec: s.durationSec,
        thumbnailUrl: s.thumbnailUrl,
        playCount: s.playCount,
        lastPlayedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      },
    })

    await prisma.playHistory.create({
      data: {
        youtubeId: s.youtubeId,
        playedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
        playedCountDelta: Math.max(1, Math.floor(s.playCount / 2)),
      },
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

