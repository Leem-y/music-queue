import { prisma } from "@/server/db"

async function main() {
  await prisma.nowPlaying.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, isPaused: false },
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

