import { NextResponse } from "next/server"
import { z } from "zod"

import { isAllowedHostIp, requireSession } from "@/server/http/session"
import { getValidSpotifyAccessToken } from "@/server/spotify/store"
import { spotifyTransfer } from "@/server/spotify/client"

export const runtime = "nodejs"

const BodySchema = z.object({
  deviceId: z.string().min(1).max(128),
  play: z.boolean().optional(),
})

export async function POST(req: Request) {
  if (!isAllowedHostIp(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const session = await requireSession(req)
  if (!session) return NextResponse.json({ error: "Missing session" }, { status: 401 })
  if (session.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Missing deviceId" }, { status: 400 })

  const token = await getValidSpotifyAccessToken(session.id)
  if (!token) return NextResponse.json({ error: "Not logged in to Spotify" }, { status: 401 })

  await spotifyTransfer({ accessToken: token.accessToken, deviceId: parsed.data.deviceId, play: parsed.data.play })
  return NextResponse.json({ ok: true })
}

