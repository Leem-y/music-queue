import { prisma } from "@/server/db"

export function getRequestIp(req: Request): string | null {
  const xf = req.headers.get("x-forwarded-for")
  const fromXf = xf ? xf.split(",")[0]?.trim() : null
  const real = req.headers.get("x-real-ip")
  const ip = (fromXf || real || null) ?? null
  if (!ip) return null
  return ip.replace(/^::ffff:/, "")
}

export function isAllowedHostIp(req: Request): boolean {
  const allowed = String(process.env.HOST_TV_IP ?? "").trim()
  if (!allowed) return true
  const ip = getRequestIp(req)
  if (!ip) return false
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true
  return ip === allowed
}

export async function getOrCreateSessionById(sessionId: string) {
  const id = String(sessionId ?? "").trim()
  if (!id) return null
  const existing = await prisma.userSession.findUnique({ where: { id } })
  if (existing) return existing
  return await prisma.userSession.create({ data: { id, role: "guest" } })
}

export async function requireSession(req: Request) {
  const sessionId =
    req.headers.get("x-mq-session-id") ??
    new URL(req.url).searchParams.get("sessionId") ??
    null
  const session = sessionId ? await prisma.userSession.findUnique({ where: { id: sessionId } }) : null
  if (!session) return null
  return session
}

