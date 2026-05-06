import { NextResponse } from "next/server"
import { z } from "zod"
import { cookies } from "next/headers"

import { prisma } from "@/server/db"
import { isAllowedHostIp } from "@/server/http/session"
import { exchangeSpotifyCodeForTokens, parseSpotifyState } from "@/server/spotify/oauth"
import { spotifyGetMe } from "@/server/spotify/client"
import { upsertSpotifyAuth } from "@/server/spotify/store"

export const runtime = "nodejs"

const QuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

export async function GET(req: Request) {
  if (!isAllowedHostIp(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    code: url.searchParams.get("code") ?? "",
    state: url.searchParams.get("state") ?? "",
  })
  if (!parsed.success) return NextResponse.json({ error: "Missing code/state" }, { status: 400 })

  const cookieStore = await cookies()
  const cookieState = cookieStore.get("mq_spotify_state")?.value ?? null
  if (!cookieState || cookieState !== parsed.data.state) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 })
  }

  const st = parseSpotifyState(parsed.data.state)
  if (!st) return NextResponse.json({ error: "Invalid state" }, { status: 400 })

  const tokens = await exchangeSpotifyCodeForTokens(parsed.data.code)
  if (!tokens.refresh_token) {
    return NextResponse.json({ error: "No refresh token returned (did you previously authorize this app?)" }, { status: 400 })
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
  const me = await spotifyGetMe(tokens.access_token).catch(() => null)

  await prisma.userSession.upsert({
    where: { id: st.sessionId },
    update: {},
    create: { id: st.sessionId, role: "guest" },
  })

  await upsertSpotifyAuth({
    sessionId: st.sessionId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    spotifyUserId: me?.id ? String(me.id) : null,
    email: me?.email ? String(me.email) : null,
    displayName: me?.display_name ? String(me.display_name) : null,
  })

  const res = NextResponse.redirect(new URL("/host?spotify=connected", url.origin))
  res.cookies.set("mq_spotify_state", "", { path: "/", maxAge: 0 })
  return res
}

