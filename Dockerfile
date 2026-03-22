# syntax=docker/dockerfile:1
FROM oven/bun:1 AS base

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY server/ .

# Generate Drizzle schema
RUN bun run db:generate

EXPOSE 3000
CMD ["bun", "run", "--hot", "server/index.ts"]
