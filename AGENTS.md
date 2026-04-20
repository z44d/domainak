# AGENTS.md

Practical guide for agentic coding assistants working in `domainak`.

## Project
- Backend: Bun + Hono + Drizzle ORM in `server/`
- Frontend: React 19 + Vite + TypeScript in `frontend/`
- Data: PostgreSQL + Redis
- Proxy/tunnel: OpenResty + Cloudflare Tunnel
- Deployment: Docker Compose + GHCR images

## Key Paths
- `server/` - API entrypoint, routes, middleware, config
- `server/db/` - Drizzle schema, Postgres bootstrap, Redis client
- `server/routes/` - feature routers: `auth`, `admin`, `domains`, `stats`
- `frontend/src/pages/` - page-level screens
- `frontend/src/components/` - reusable UI
- `frontend/src/lib/` - API client, helpers, shared types
- `.github/workflows/` - deployment workflows
- `docker-compose.yaml` - container stack
- `nginx.conf` - OpenResty routing config
- `setup.sh` - guided install/update script

## Package Tools
- Use `bun` for root/backend work.
- Use `bun` in `frontend/` too.
- Both packages are ESM (`"type": "module"`).
- Prefer package scripts over ad hoc equivalents.

## Install / Dev / Build / Lint
Install:
```bash
bun install
cd frontend && bun install
```
Dev:
```bash
bun run server
cd frontend && bun run dev
cd frontend && bun run preview
```
Build:
```bash
cd frontend && bun run build
docker compose up -d --build
curl -fsSL https://raw.githubusercontent.com/z44d/domainak/main/setup.sh | bash
```
Lint:
```bash
bun run lint
bunx @biomejs/biome check server
cd frontend && bun run lint
bunx tsc --noEmit
```
Notes:
- backend has no dedicated build script; it runs from `server/index.ts`
- root `lint` runs `biome check server --write --unsafe`, so it mutates files

## Tests
- There is no automated test script in either `package.json`.
- No repo-local unit/integration test runner is configured right now.
- There is no canonical `bun test`, `vitest`, or `jest` command.
- There is no single-test command yet.
- Verification currently means linting, building, and manual API/UI checks.

## Single-Test Guidance
Single-test execution is not supported today because the repo has no configured test framework.
If you add one, document all of these in this file:
- full-suite command
- single-file command
- single-test-by-name command
- env/setup requirements

## Database and Docker Commands
```bash
bun run db:generate
bun run db:migrate
bun run db:push
bun run db:studio
docker compose up -d --build
docker compose down
docker compose ps
docker compose logs backend --tail=200
docker compose logs openresty --tail=200
docker compose logs cloudflared --tail=200
```

## Formatting Rules
`biome.json` is the main source of truth for backend/shared TS/JS.
- indentation: 2 spaces
- line width: 75
- line endings: LF
- strings: double quotes
- JSX strings: double quotes
- semicolons: required
- arrow function params: always use parentheses
- `import type` where applicable
- Node built-ins should use the `node:` protocol
- unused imports and variables are errors

Frontend `eslint.config.js` additionally enforces:
- JS/TS recommended rules
- React Hooks rules
- Vite React refresh rules

## Imports
- Keep external imports before local imports.
- Use type-only imports where possible.
- Backend code currently prefers explicit relative imports.
- Frontend supports `@/*`, but most existing code uses relative imports.
- Keep imports organized; Biome may reorder them.

## Naming
- React components: PascalCase (`Navbar`, `DomainStatsChart`)
- page files/components: PascalCase (`Admin.tsx`, `Dashboard.tsx`)
- functions and variables: camelCase
- constants: UPPER_SNAKE_CASE (`PAGE_SIZE`, `MAX_PAGE_SIZE`)
- table variables: lower camel case ending in `Table` (`userTable`)
- route files: lowercase feature names (`auth.ts`, `admin.ts`)
- interfaces/types: PascalCase (`User`, `PaginationMeta`)

## TypeScript
- `strict` mode is enabled; keep code strict.
- `noUncheckedIndexedAccess` is enabled; guard indexed reads.
- Avoid `any` when practical, even though it is not globally banned.
- Prefer typed response shapes and narrow unions over loose objects.
- Keep shared frontend response types in `frontend/src/lib/types.ts` or nearby.
- Current backend auth context still uses `Variables: { user: any }`; improve carefully and consistently if you touch it.

## Error Handling
- Backend routes usually return `c.json({ error: message }, status)`.
- Auth flows redirect to `FRONTEND_URL` with query-string errors.
- Catch unknown errors and log meaningful context with `console.error`.
- Frontend fetch code throws `ApiError`; handle it explicitly.
- Prefer `getErrorMessage()` for user-facing frontend messages.
- In React effects, use `AbortController` and avoid post-abort state updates.

## React Conventions
- Use functional components and hooks.
- Keep loading, error, and feedback state explicit in page components.
- Use `useCallback`, `useMemo`, and `useRef` when they help behavior or dependency stability.
- Redirect unauthorized users in page logic when needed.
- Session token storage currently uses `localStorage` key `session_token`.

## Backend Conventions
- Mount feature routers from `server/index.ts`.
- Keep route-local helpers near the route file unless broadly reusable.
- Use Drizzle query builders directly; current code favors explicit queries.
- Pagination helpers are plain functions near route definitions.
- Middleware returns JSON errors instead of throwing framework exceptions.

## Config and Deployment
- Backend env handling is centralized in `server/config.ts`.
- Frontend API base URL comes from `import.meta.env.VITE_API_URL`.
- `docker-compose.yaml` builds local backend/frontend images and tags them with the GHCR image names.
- `setup.sh` writes deployment env vars into `~/.domainak/.env`.
- `setup.sh` downloads `docker-compose.yaml` and `nginx.conf` into `~/.domainak`.

## Cursor and Copilot Rules
No repo-specific rule files were found:
- no `.cursor/rules/`
- no `.cursorrules`
- no `.github/copilot-instructions.md`

## Workflow Advice
- Check `git status` before editing; the worktree may be dirty.
- Do not overwrite unrelated local changes.
- Match existing code patterns before introducing abstractions.
- Run fresh verification commands before claiming success.
- If you add new commands or tooling, update `AGENTS.md` too.
