import type { RecommendationDTO } from "@/shared/events"
import { prisma } from "@/server/db"

export async function recordPlay(provider: string, trackId: string) {
  const p = String(provider ?? "").trim()
  const id = String(trackId ?? "").trim()
  if (!p || !id) return

  await prisma.$transaction([
    prisma.songMetadata.upsert({
      where: { provider_trackId: { provider: p, trackId: id } },
      update: {
        playCount: { increment: 1 },
        lastPlayedAt: new Date(),
      },
      create: {
        provider: p,
        trackId: id,
        title: "Unknown title",
        playCount: 1,
        lastPlayedAt: new Date(),
      },
    }),
    prisma.playHistory.create({
      data: {
        provider: p,
        trackId: id,
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
    by: ["provider", "trackId"],
    where: { playedAt: { gte: since } },
    _sum: { playedCountDelta: true },
    orderBy: { _sum: { playedCountDelta: "desc" } },
    take: Math.min(limit, 10),
  })

  const recentKeys = recentAgg.map((r) => ({ provider: r.provider, trackId: r.trackId }))
  const recentMetas = recentKeys.length
    ? await prisma.songMetadata.findMany({
        where: { OR: recentKeys.map((k) => ({ provider: k.provider, trackId: k.trackId })) },
      })
    : []
  const recentByKey = new Map(recentMetas.map((m) => [`${m.provider}:${m.trackId}`, m] as const))

  const out: RecommendationDTO[] = []
  const seen = new Set<string>()

  for (const m of mostPlayed) {
    if (out.length >= limit) break
    const key = `${m.provider}:${m.trackId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      provider: m.provider,
      trackId: m.trackId,
      title: m.title,
      artist: m.artist,
      thumbnailUrl: m.thumbnailUrl,
      durationSec: m.durationSec,
      audioUrl: m.audioUrl,
      reason: "most_played",
    })
  }

  for (const k of recentKeys) {
    if (out.length >= limit) break
    const key = `${k.provider}:${k.trackId}` as `${string}:${string}`
    if (seen.has(key)) continue
    const m = recentByKey.get(key)
    if (!m) continue
    seen.add(key)
    out.push({
      provider: m.provider,
      trackId: m.trackId,
      title: m.title,
      artist: m.artist,
      thumbnailUrl: m.thumbnailUrl,
      durationSec: m.durationSec,
      audioUrl: m.audioUrl,
      reason: "recently_popular",
    })
  }

  return out
}

