import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import path from "path"

function sqliteFilePathFromDatabaseUrl(url: string) {
  if (!url.startsWith("file:")) return url
  const raw = url.slice("file:".length)
  // Prisma commonly uses file:./dev.db; better-sqlite3 wants an actual filesystem path.
  return path.resolve(process.cwd(), raw)
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error("DATABASE_URL is not set")

    const sqlitePath = sqliteFilePathFromDatabaseUrl(url)
    const adapter = new PrismaBetterSqlite3({ url: sqlitePath })

    const client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    })

    return client
  })()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

