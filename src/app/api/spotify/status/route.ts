import { NextResponse } from "next/server"

import { isAllowedHostIp, requireSession } from "@/server/http/session"
import { prisma } from "@/server/db"

export const runtime = "nodejs"

export async function GET(req: Request) {
  if (!isAllowedHostIp(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const session = await requireSession(req)
  if (!session) return NextResponse.json({ loggedIn: false, user: null }, { status: 200 })

  const auth = await prisma.spotifyAuth.findUnique({ where: { sessionId: session.id } })
  if (!auth) return NextResponse.json({ loggedIn: false, user: null }, { status: 200 })

  return NextResponse.json({
    loggedIn: true,
    user: {
      sessionId: session.id,
      spotifyUserId: auth.spotifyUserId,
      email: auth.email,
      displayName: auth.displayName,
      hasDeviceSelected: !!session.spotifyDeviceId,
      deviceId: session.spotifyDeviceId ?? null,
    },
  })
}

