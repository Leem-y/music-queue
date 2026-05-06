import crypto from "crypto"

import { spotifyScopesString } from "@/server/spotify/scopes"

function spotifyClientId() {
  const v = String(process.env.SPOTIFY_CLIENT_ID ?? "").trim()
  if (!v) throw new Error("Missing SPOTIFY_CLIENT_ID")
  return v
}

function spotifyClientSecret() {
  const v = String(process.env.SPOTIFY_CLIENT_SECRET ?? "").trim()
  if (!v) throw new Error("Missing SPOTIFY_CLIENT_SECRET")
  return v
}

function spotifyRedirectUri() {
  const v = String(process.env.SPOTIFY_REDIRECT_URI ?? "").trim()
  if (!v) throw new Error("Missing SPOTIFY_REDIRECT_URI")
  return v
}

export function buildSpotifyAuthorizeUrl(args: { state: string }) {
  const url = new URL("https://accounts.spotify.com/authorize")
  url.searchParams.set("client_id", spotifyClientId())
  url.searchParams.set("response_type", "code")
  url.searchParams.set("redirect_uri", spotifyRedirectUri())
  url.searchParams.set("scope", spotifyScopesString())
  url.searchParams.set("state", args.state)
  // Authorization Code flow (no PKCE needed for confidential server)
  return url.toString()
}

export type SpotifyTokenExchangeResponse = {
  access_token: string
  token_type: string
  scope?: string
  expires_in: number
  refresh_token?: string
}

async function spotifyTokenRequest(body: URLSearchParams) {
  const basic = Buffer.from(`${spotifyClientId()}:${spotifyClientSecret()}`).toString("base64")
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Spotify token error: ${res.status} ${text}`)
  return JSON.parse(text) as SpotifyTokenExchangeResponse
}

export async function exchangeSpotifyCodeForTokens(code: string) {
  const c = String(code ?? "").trim()
  if (!c) throw new Error("Missing code")
  return await spotifyTokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: c,
      redirect_uri: spotifyRedirectUri(),
    }),
  )
}

export async function refreshSpotifyAccessToken(refreshToken: string) {
  const rt = String(refreshToken ?? "").trim()
  if (!rt) throw new Error("Missing refresh token")
  return await spotifyTokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: rt,
    }),
  )
}

export function makeSpotifyState(sessionId: string) {
  const sid = String(sessionId ?? "").trim()
  if (!sid) throw new Error("Missing session id")
  const nonce = crypto.randomBytes(16).toString("hex")
  return `${sid}.${nonce}`
}

export function parseSpotifyState(state: string) {
  const raw = String(state ?? "").trim()
  const [sessionId, nonce] = raw.split(".")
  if (!sessionId || !nonce) return null
  if (sessionId.length < 6 || nonce.length < 16) return null
  return { sessionId, nonce }
}

