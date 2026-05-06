import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/server/db"
import { isAllowedHostIp, requireSession } from "@/server/http/session"

export const runtime = "nodejs"

const BodySchema = z.object({
  deviceId: z.string().min(1).max(128),
})

export async function POST(req: Request) {
  if (!isAllowedHostIp(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const session = await requireSession(req)
  if (!session) return NextResponse.json({ error: "Missing session" }, { status: 401 })
  if (session.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Missing deviceId" }, { status: 400 })

  await prisma.userSession.update({
    where: { id: session.id },
    data: { spotifyDeviceId: parsed.data.deviceId },
  })

  // Mark this session as the active Spotify playback controller for the party.
  await prisma.nowPlaying.upsert({
    where: { id: 1 },
    update: { playbackSessionId: session.id },
    create: { id: 1, isPaused: false, playbackSessionId: session.id },
  })

  return NextResponse.json({ ok: true })
}

