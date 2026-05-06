import { prisma } from "@/server/db"
import { refreshSpotifyAccessToken } from "@/server/spotify/oauth"

export async function getSpotifyAuthForSession(sessionId: string) {
  return await prisma.spotifyAuth.findUnique({ where: { sessionId } })
}

export async function upsertSpotifyAuth(args: {
  sessionId: string
  accessToken: string
  refreshToken: string
  expiresAt: Date
  spotifyUserId: string | null
  email: string | null
  displayName: string | null
}) {
  return await prisma.spotifyAuth.upsert({
    where: { sessionId: args.sessionId },
    update: {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      spotifyUserId: args.spotifyUserId,
      email: args.email,
      displayName: args.displayName,
    },
    create: {
      sessionId: args.sessionId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      spotifyUserId: args.spotifyUserId,
      email: args.email,
      displayName: args.displayName,
    },
  })
}

export async function getValidSpotifyAccessToken(sessionId: string) {
  const row = await prisma.spotifyAuth.findUnique({ where: { sessionId } })
  if (!row) return null

  const now = Date.now()
  const expiresAtMs = row.expiresAt.getTime()
  if (expiresAtMs - now > 60_000) return { accessToken: row.accessToken, refreshed: false as const }

  const refreshed = await refreshSpotifyAccessToken(row.refreshToken)
  const accessToken = refreshed.access_token
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000)

  await prisma.spotifyAuth.update({
    where: { sessionId },
    data: { accessToken, expiresAt },
  })

  return { accessToken, refreshed: true as const }
}

