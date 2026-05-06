import { NextResponse } from "next/server"

import { isAllowedHostIp, requireSession } from "@/server/http/session"
import { getValidSpotifyAccessToken } from "@/server/spotify/store"
import { spotifyGetPlayback } from "@/server/spotify/client"

export const runtime = "nodejs"

export async function GET(req: Request) {
  if (!isAllowedHostIp(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const session = await requireSession(req)
  if (!session) return NextResponse.json({ error: "Missing session" }, { status: 401 })
  if (session.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const token = await getValidSpotifyAccessToken(session.id)
  if (!token) return NextResponse.json({ error: "Not logged in to Spotify" }, { status: 401 })

  const playback = await spotifyGetPlayback(token.accessToken)
  return NextResponse.json({ playback })
}

