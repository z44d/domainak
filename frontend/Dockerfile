FROM oven/bun:1.3.11 AS base

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Expose URL config to NextJS build process
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the Next.js app
RUN bun run build

EXPOSE 5173
CMD ["bun", "run", "start"]
