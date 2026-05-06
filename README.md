# Music Queue (LAN Party)

Apple Music-inspired, local-network party music queue powered by YouTube.

## Features
- **Guest UI**: search YouTube, add to queue, see what’s playing.
- **Host TV UI** (`/host`): fullscreen now-playing, queue, pairing code, admin controls.
- **Real-time sync** via Socket.IO (no refresh).
- **Persistence**: SQLite + Prisma.
- **Recommendations**: most-played + recently popular (shown when the queue is empty).
- **Lobby music** (host): when the queue is empty, `/host` plays ambient “waiting” audio until someone queues a track.

## Tech
- Next.js (App Router) + React + TypeScript
- Tailwind + shadcn/ui
- Socket.IO (custom Node server)
- Prisma + SQLite
- YouTube: server-side search/metadata via `youtubei.js`, host playback via YouTube IFrame API

## Setup

### 1) Install dependencies

```bash
pnpm install
```

### 2) Configure env

```bash
copy .env.example .env
```

Optional:
- `NEXT_PUBLIC_LOBBY_YOUTUBE_ID`: 11-character YouTube video id for idle lobby playback on `/host` (set to empty to disable).

### 3) Create DB + seed

```bash
pnpm prisma migrate dev
pnpm prisma generate
pnpm prisma db seed
```

### 4) Run (LAN)

```bash
pnpm dev
```

Open on the host machine:
- Guest UI: `http://localhost:3000/`
- Host TV UI: `http://localhost:3000/host`

To allow phones/tablets on the same network to connect:
- Make sure `.env` uses `HOST="0.0.0.0"`.
- Find your host machine IP (e.g. `192.168.1.50`).
- Guests open: `http://<host-ip>:3000/`

## Admin pairing + shortcuts
- Host screen shows a **6-digit pairing code**.
- Enter it on the host (or any device) to enable **Admin**.
- Host keyboard shortcuts (admin only; disabled while **lobby music** is playing):
  - Space: pause/resume
  - Right arrow: skip
  - C: clear queue

## Notes on YouTube playback
- Browsers restrict autoplay with sound. The host page shows a **“Tap to start playback”** overlay the first time—after that, continuous playback is typically allowed.
- This project does **not** download/stream raw audio; it plays via the official IFrame player.

## Docker (optional)

```bash
docker compose up --build
```

Then open `http://<host-ip>:3000/`.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
