# Domainak

Domainak is a GitHub-authenticated subdomain router with a React dashboard, a Hono API, Postgres for metadata, Redis for routing and traffic counters, and OpenResty for dynamic proxying.

## What it does

- Create subdomains like `app.example.com` and point them at any reachable host and port.
- Proxy matching traffic through OpenResty using Redis-backed routing lookups.
- Track traffic totals, yearly, monthly, weekly, and daily visitors in Redis.
- Manage the platform from an admin panel with paginated views for domains, users, banned users, banned domains, and blocked IPs.
- Ban users, domains, and IPs without being limited to the latest 100 records.

## Stack

- Backend: Bun + Hono + Drizzle ORM
- Frontend: React + Vite
- Database: PostgreSQL
- Cache and routing store: Redis
- Edge proxy: OpenResty / Nginx with Lua
- Tunnel: Cloudflare Tunnel via `cloudflared`

## Repository layout

- `server/` - Hono API, DB access, auth, admin routes, migrations
- `frontend/` - React admin and user dashboard
- `nginx.conf` - OpenResty config for dynamic domain routing and traffic analytics
- `docker-compose.yaml` - full container stack
- `Dockerfile` - backend production image

## Requirements

### Local development

- Bun 1.3+
- Node.js 20+ or Bun for the frontend tooling
- PostgreSQL 15+
- Redis 7+
- A GitHub OAuth app

### VPS / Docker deployment

- Docker Engine
- Docker Compose plugin
- A domain already delegated to Cloudflare
- A Cloudflare Tunnel token
- A GitHub OAuth app configured with your public backend callback URL

## Environment variables

Copy `.env.example` to `.env` and fill in every required value.

Key values:

- `DOMAINS` - space-separated base domains users can register under
- `POSTGRES_PASSWORD` - required for the bundled Postgres container
- `POSTGRES_USER` / `POSTGRES_DB` - optional, but recommended
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - required for login
- `ADMIN_IDS` - comma-separated GitHub user IDs with admin access
- `JWT_SECRET` - required and should be long and random
- `WEBSITE_URL` - browser URL for the frontend
- `BACKEND_URL` - browser-facing API URL, usually ending in `/api`
- `TUNNEL_TOKEN` - required for Cloudflare Tunnel in Docker deployment

## GitHub OAuth setup

Create an OAuth app at `https://github.com/settings/applications/new`.

Recommended callback URLs:

- Local: `http://localhost:2007/auth/callback`
- VPS: `https://api.your-domain.com/auth/callback`

Homepage URL examples:

- Local: `http://localhost:5173`
- VPS: `https://panel.your-domain.com`

## Local setup

### 1. Clone and install

```bash
git clone <your-fork-or-repo-url>
cd domainak
bun install
cd frontend && bun install && cd ..
```

### 2. Start PostgreSQL and Redis

Use local services, Docker, or your existing infrastructure.

Example with Docker only for data services:

```bash
docker run -d --name domainak-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=domainak \
  -p 5432:5432 postgres:alpine

docker run -d --name domainak-redis -p 6379:6379 redis:alpine
```

### 3. Create `.env`

Example local values:

```env
DOMAINS=localhost example.test
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/domainak
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=domainak
REDIS_URL=redis://localhost:6379
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
ADMIN_IDS=12345678
JWT_SECRET=replace-with-a-long-random-secret
WEBSITE_URL=http://localhost:5173
BACKEND_URL=http://localhost:2007/api
```

### 4. Start the backend

```bash
bun run server
```

The API will be available on `http://localhost:2007` and also supports the `/api` prefix for frontend compatibility.

### 5. Start the frontend

```bash
cd frontend
bun run dev
```

The frontend will be available on `http://localhost:5173`.

### 6. Optional: run OpenResty locally

If you want to test actual dynamic subdomain proxying locally:

```bash
docker run --rm -p 2006:80 \
  --add-host=host.docker.internal:host-gateway \
  -v "$PWD/nginx.conf:/usr/local/openresty/nginx/conf/nginx.conf:ro" \
  --network host openresty/openresty:alpine
```

For most UI and API work, this is not required.

## Fresh VPS setup

These steps assume Ubuntu 24.04, a clean server, and Cloudflare-managed DNS.

### Quick installer

If Docker is already installed, you can use the guided installer instead of setting everything up manually:

```bash
curl -fsSL https://raw.githubusercontent.com/z44d/domainak/main/setup.sh | bash
```

What it does:

- asks for all required environment variables in an interactive terminal UI
- stores them in `~/.domainak/.env`
- downloads `docker-compose.yaml` and `nginx.conf` into `~/.domainak`
- starts or updates the stack with Docker Compose

If `~/.domainak/.env` already exists, the installer switches to update mode and pre-fills your current values.

### 1. Install Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clone the project

```bash
git clone <your-fork-or-repo-url>
cd domainak
```

### 3. Create `.env`

Example production values:

```env
TUNNEL_TOKEN=your_cloudflare_tunnel_token
DOMAINS=example.com demo.example.com
POSTGRES_USER=domainak
POSTGRES_PASSWORD=replace_me
POSTGRES_DB=domainak
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
ADMIN_IDS=12345678,87654321
JWT_SECRET=replace-with-a-long-random-secret
WEBSITE_URL=https://panel.example.com
BACKEND_URL=https://api.example.com/api
```

Notes:

- `BACKEND_URL` should be the public API URL used by browsers.
- `WEBSITE_URL` must match the public panel URL and GitHub OAuth configuration.
- `DOMAINS` should contain every suffix you want users to register.

### 4. Verify DNS and tunnel design

Common production layout:

- `panel.example.com` -> frontend
- `api.example.com` -> backend
- `*.example.com` -> Cloudflare Tunnel -> OpenResty -> target services

### 5. Start the stack

```bash
docker compose up -d --build
```

### 6. Inspect service health

```bash
docker compose ps
docker compose logs backend --tail=100
docker compose logs openresty --tail=100
docker compose logs cloudflared --tail=100
```

### 7. Open the panel

Visit your `WEBSITE_URL`, sign in with GitHub, and verify your GitHub user ID is in `ADMIN_IDS` if you need admin access.

## Ports

- `2006` -> OpenResty
- `2007` -> backend API
- `5173` -> frontend container
- `5432` -> PostgreSQL inside Docker network
- `6379` -> Redis inside Docker network

## API notes

The backend now serves routes both with and without the `/api` prefix:

- `http://localhost:2007/auth/me`
- `http://localhost:2007/api/auth/me`

That keeps the frontend and Docker setup aligned without breaking existing direct backend calls.

## Admin panel features

The admin panel now includes paginated queues for:

- all domains
- all users
- banned users
- banned domains
- blocked IPs / hostnames

It also supports:

- banning or unbanning users
- removing domains
- banning active or manual domain entries
- unbanning banned domains
- banning and unbanning IPs / hostnames

## Traffic analytics behavior

`nginx.conf` now uses a Redis Lua script to increment visitor counters and assign expirations without relying on individual helper methods that may not be available in `lua-resty-redis`.

Current retention windows:

- total: 365 days
- yearly: 365 days
- monthly: 90 days
- weekly: 40 days
- daily: 7 days

This avoids stale analytics keys accumulating forever while keeping current dashboard stats responsive.

## Performance changes included

- paginated admin data instead of loading a capped but heavy global table
- new database indexes for admin queries
- backend Docker image now runs in production mode without hot reload
- backend container healthcheck and improved service ordering
- OpenResty connection reuse and banned-domain short-circuiting

## Useful commands

Backend:

```bash
bun run server
```

Frontend:

```bash
cd frontend
bun run dev
```

Rebuild Docker stack:

```bash
docker compose up -d --build
```

Stop Docker stack:

```bash
docker compose down
```

## Troubleshooting

### GitHub login redirects back with an error

- Confirm `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
- Confirm the callback URL in GitHub matches the backend public URL
- Confirm `WEBSITE_URL` points to the actual browser URL

### Admin page redirects away

- Your GitHub user ID is probably missing from `ADMIN_IDS`
- Fetch your ID with `curl -s https://api.github.com/users/<username>`

### Subdomains do not resolve

- Confirm the route exists in the dashboard
- Confirm OpenResty can reach Redis
- Confirm your target host and port are reachable from the Docker network or server
- Confirm Cloudflare Tunnel is running and your DNS points at it

### Docker stack starts but login fails

- Make sure the backend service receives `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `WEBSITE_URL`, `JWT_SECRET`, and `ADMIN_IDS`
- Run `docker compose logs backend --tail=200`

### Stats look empty

- Send traffic through a registered domain, not directly to the backend
- Check `docker compose logs openresty --tail=200`
- Check Redis connectivity from the OpenResty container

## Development checklist

- Update `.env`
- Start Postgres and Redis
- Run backend with `bun run server`
- Run frontend with `cd frontend && bun run dev`
- Sign in through GitHub
- Test admin pagination and bans with an admin account
