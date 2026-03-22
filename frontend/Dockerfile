# syntax=docker/dockerfile:1
FROM oven/bun:1 AS base

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Build the Next.js app
RUN bun run build

EXPOSE 5173
CMD ["bun", "run", "start"]
