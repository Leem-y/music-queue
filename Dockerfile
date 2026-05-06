FROM node:22-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

FROM base AS deps
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

FROM base AS run
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /app ./

EXPOSE 3000
CMD ["pnpm","start"]

