import type { RecommendationDTO } from "@/shared/events"
import { prisma } from "@/server/db"

export async function recordPlay(youtubeId: string) {
  const id = String(youtubeId ?? "").trim()
  if (!id) return

  await prisma.$transaction([
    prisma.songMetadata.upsert({
      where: { youtubeId: id },
      update: {
        playCount: { increment: 1 },
        lastPlayedAt: new Date(),
      },
      create: {
        youtubeId: id,
        title: "Unknown title",
        playCount: 1,
        lastPlayedAt: new Date(),
      },
    }),
    prisma.playHistory.create({
      data: {
        youtubeId: id,
        playedAt: new Date(),
        playedCountDelta: 1,
      },
    }),
  ])
}

export async function getRecommendations(limit = 10): Promise<RecommendationDTO[]> {
  const mostPlayed = await prisma.songMetadata.findMany({
    orderBy: [{ playCount: "desc" }, { lastPlayedAt: "desc" }],
    take: Math.min(limit, 10),
  })

  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
  const recentAgg = await prisma.playHistory.groupBy({
    by: ["youtubeId"],
    where: { playedAt: { gte: since } },
    _sum: { playedCountDelta: true },
    orderBy: { _sum: { playedCountDelta: "desc" } },
    take: Math.min(limit, 10),
  })

  const recentIds = recentAgg.map((r) => r.youtubeId)
  const recentMetas = recentIds.length
    ? await prisma.songMetadata.findMany({ where: { youtubeId: { in: recentIds } } })
    : []
  const recentById = new Map(recentMetas.map((m) => [m.youtubeId, m] as const))

  const out: RecommendationDTO[] = []
  const seen = new Set<string>()

  for (const m of mostPlayed) {
    if (out.length >= limit) break
    if (seen.has(m.youtubeId)) continue
    seen.add(m.youtubeId)
    out.push({
      youtubeId: m.youtubeId,
      title: m.title,
      artist: m.artist,
      thumbnailUrl: m.thumbnailUrl,
      durationSec: m.durationSec,
      reason: "most_played",
    })
  }

  for (const id of recentIds) {
    if (out.length >= limit) break
    if (seen.has(id)) continue
    const m = recentById.get(id)
    if (!m) continue
    seen.add(id)
    out.push({
      youtubeId: m.youtubeId,
      title: m.title,
      artist: m.artist,
      thumbnailUrl: m.thumbnailUrl,
      durationSec: m.durationSec,
      reason: "recently_popular",
    })
  }

  return out
}

