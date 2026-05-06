import { NextResponse } from "next/server"
import { z } from "zod"

import { getOrCreateSessionById, isAllowedHostIp } from "@/server/http/session"
import { buildSpotifyAuthorizeUrl, makeSpotifyState } from "@/server/spotify/oauth"

export const runtime = "nodejs"

const QuerySchema = z.object({
  sessionId: z.string().min(6).max(128),
})

export async function GET(req: Request) {
  if (!isAllowedHostIp(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({ sessionId: url.searchParams.get("sessionId") ?? "" })
  if (!parsed.success) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })

  await getOrCreateSessionById(parsed.data.sessionId)

  const state = makeSpotifyState(parsed.data.sessionId)
  const authorizeUrl = buildSpotifyAuthorizeUrl({ state })

  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set("mq_spotify_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  })
  return res
}

