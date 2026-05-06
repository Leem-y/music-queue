"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Search, Shield, Tv } from "lucide-react"

import { useSocketSync } from "@/client/useSocketSync"
import { useSecondTick } from "@/client/useSecondTick"
import { getSocket } from "@/client/socket"
import { useAppStore } from "@/client/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

type SearchResult = {
  youtubeId: string
  title: string
  artist: string | null
  thumbnailUrl: string | null
  durationSec: number | null
}

function formatDuration(sec: number | null) {
  if (!sec || !Number.isFinite(sec)) return ""
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`
}

export default function GuestPage() {
  useSocketSync()
  useSecondTick()

  const usersCount = useAppStore((s) => s.usersCount)
  const nowPlaying = useAppStore((s) => s.nowPlaying)
  const queue = useAppStore((s) => s.queue)
  const role = useAppStore((s) => s.role)
  const name = useAppStore((s) => s.name)
  const pairingCode = useAppStore((s) => s.pairingCode)
  const pairingCodeTtlMs = useAppStore((s) => s.pairingCodeTtlMs)

  const [nameDraft, setNameDraft] = useState(name ?? "")
  const [pairDraft, setPairDraft] = useState("")

  useEffect(() => setNameDraft(name ?? ""), [name])

  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])

  const socket = useMemo(() => getSocket(), [])

  useEffect(() => {
    let cancelled = false
    const query = q.trim()
    if (!query) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const json = (await res.json()) as { results?: SearchResult[] }
        if (cancelled) return
        setResults(json.results ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q])

  return (
    <div className="min-h-full flex-1 bg-black text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-gradient-to-b from-white/10 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full bg-gradient-to-t from-fuchsia-500/10 via-indigo-500/10 to-transparent blur-3xl" />
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/10 ring-1 ring-white/10 grid place-items-center">
              <Search className="h-5 w-5 text-white/80" />
            </div>
            <div>
              <div className="text-xl font-semibold tracking-tight">Music Queue</div>
              <div className="text-sm text-white/60">
                {usersCount} online{role === "admin" ? " • Admin" : ""}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Your name"
                className="h-10 w-full sm:w-56 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <Button
                variant="secondary"
                className="h-10 bg-white/10 text-white hover:bg-white/15"
                onClick={() => socket?.emit("me:setName", { name: nameDraft })}
              >
                Save
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="text-[11px] text-white/60 leading-none">Pairing code</div>
                <div className="mt-1 font-mono text-sm tracking-widest">{pairingCode}</div>
                <div className="mt-1 text-[11px] text-white/45 leading-none">
                  rotates in {Math.max(0, Math.ceil(pairingCodeTtlMs / 1000))}s
                </div>
              </div>
              <Dialog>
                <DialogTrigger
                  render={
                    <Button variant="secondary" className="h-10 bg-white/10 text-white hover:bg-white/15 gap-2">
                      <Shield className="h-4 w-4" />
                      Admin
                    </Button>
                  }
                >
                  Admin
                </DialogTrigger>
                <DialogContent className="bg-zinc-950 border-white/10 text-white">
                  <DialogHeader>
                    <DialogTitle>Admin pairing</DialogTitle>
                    <DialogDescription className="text-white/60">Enter the code shown on the host TV.</DialogDescription>
                  </DialogHeader>
                  <div className="flex items-center gap-2">
                    <Input
                      value={pairDraft}
                      onChange={(e) => setPairDraft(e.target.value)}
                      placeholder="000000"
                      className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    />
                    <Button
                      className="h-11 rounded-full bg-white text-black hover:bg-white/90"
                      onClick={() => socket?.emit("admin:pair", { code: pairDraft })}
                    >
                      Pair
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Link href="/host" className="inline-flex">
              <Button className="h-10 gap-2 rounded-full bg-white text-black hover:bg-white/90">
                <Tv className="h-4 w-4" />
                Host TV
              </Button>
            </Link>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-4">
            <Card className="border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
                  {nowPlaying.thumbnailUrl ? (
                    <Image src={nowPlaying.thumbnailUrl} alt="" fill className="object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white/60">Now playing</div>
                  <div className="truncate font-medium">
                    {nowPlaying.youtubeId ? nowPlaying.title ?? "Playing" : "Nothing yet"}
                  </div>
                  <div className="truncate text-sm text-white/60">{nowPlaying.artist ?? ""}</div>
                </div>
                {nowPlaying.durationSec ? (
                  <Badge variant="secondary" className="bg-white/10 text-white">
                    {formatDuration(nowPlaying.durationSec)}
                  </Badge>
                ) : null}
              </div>
            </Card>

            <Card className="border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-white/60" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search YouTube for songs"
                  className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>
              <div className="mt-4">
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-xl bg-white/10" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-2/3 bg-white/10" />
                          <Skeleton className="h-3 w-1/3 bg-white/10" />
                        </div>
                        <Skeleton className="h-9 w-24 rounded-full bg-white/10" />
                      </div>
                    ))}
                  </div>
                ) : results.length ? (
                  <div className="space-y-2">
                    {results.map((r) => (
                      <div
                        key={r.youtubeId}
                        className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-white/5 transition-colors"
                      >
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
                          {r.thumbnailUrl ? <Image src={r.thumbnailUrl} alt="" fill className="object-cover" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{r.title}</div>
                          <div className="truncate text-sm text-white/60">{r.artist ?? ""}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {r.durationSec ? (
                            <Badge variant="secondary" className="bg-white/10 text-white">
                              {formatDuration(r.durationSec)}
                            </Badge>
                          ) : null}
                          <Button
                            className="rounded-full bg-white text-black hover:bg-white/90"
                            onClick={() => socket?.emit("queue:add", { youtubeId: r.youtubeId })}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : q.trim() ? (
                  <div className="text-sm text-white/60">No results.</div>
                ) : (
                  <div className="text-sm text-white/60">Start typing to search.</div>
                )}
              </div>
            </Card>
          </section>

          <section>
            <Card className="border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold tracking-tight">Up next</div>
                <Badge variant="secondary" className="bg-white/10 text-white">
                  {queue.length}
                </Badge>
              </div>
              <Separator className="my-4 bg-white/10" />
              <ScrollArea className="h-[560px] pr-2">
                <div className="space-y-2">
                  {queue.length ? (
                    queue.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-white/5 transition-colors"
                      >
                        <div className="w-8 text-right tabular-nums text-sm text-white/50">{idx + 1}</div>
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
                          {item.thumbnailUrl ? (
                            <Image src={item.thumbnailUrl} alt="" fill className="object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{item.title}</div>
                          <div className="truncate text-sm text-white/60">
                            {item.artist ?? ""}
                            {item.addedByName ? ` • Added by ${item.addedByName}` : ""}
                          </div>
                        </div>
                        {item.durationSec ? (
                          <Badge variant="secondary" className="bg-white/10 text-white">
                            {formatDuration(item.durationSec)}
                          </Badge>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/60">
                      The queue is empty. Add a song to get the party started.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Card>
          </section>
        </div>
      </main>
    </div>
  )
}
