import "dotenv/config"

import { createServer } from "http"
import next from "next"
import { Server as SocketIOServer } from "socket.io"

import { registerSocketHandlers } from "@/server/socket"
import type { ClientToServerEvents, ServerToClientEvents } from "@/shared/events"

const dev = process.env.NODE_ENV !== "production"
const port = Number(process.env.PORT ?? 3000)
const hostname = process.env.HOST ?? "0.0.0.0"

const app = next({ dev, hostname, port })
const handler = app.getRequestHandler()

async function main() {
  await app.prepare()

  const httpServer = createServer((req, res) => handler(req, res))

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    path: "/socket.io",
  })

  registerSocketHandlers(io)

  httpServer.listen(port, hostname, () => {
    // eslint-disable-next-line no-console
    console.log(`Ready on http://${hostname}:${port}`)
  })
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})

