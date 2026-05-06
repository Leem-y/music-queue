import { NextResponse } from "next/server"
import { z } from "zod"

import { getMusicProvider } from "@/server/music/provider"

export const runtime = "nodejs"

const QuerySchema = z.object({
  q: z.string().min(1).max(120),
})

export async function GET(req: Request) {
  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({ q: url.searchParams.get("q") ?? "" })
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 })
  }

  const provider = getMusicProvider()
  const results = await provider.search(parsed.data.q, 16)

  return NextResponse.json({ results })
}

