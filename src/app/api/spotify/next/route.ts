import { NextResponse } from "next/server"

import { isAllowedHostIp, requireSession } from "@/server/http/session"
import { getValidSpotifyAccessToken } from "@/server/spotify/store"
import { spotifyNext } from "@/server/spotify/client"

export const runtime = "nodejs"

export async function POST(req: Request) {
  if (!isAllowedHostIp(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const session = await requireSession(req)
  if (!session) return NextResponse.json({ error: "Missing session" }, { status: 401 })
  if (session.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const token = await getValidSpotifyAccessToken(session.id)
  if (!token) return NextResponse.json({ error: "Not logged in to Spotify" }, { status: 401 })

  await spotifyNext({ accessToken: token.accessToken, deviceId: session.spotifyDeviceId })
  return NextResponse.json({ ok: true })
}

