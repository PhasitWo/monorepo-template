# monorepo-csr-template

Full-stack TypeScript monorepo starter: **Fastify + Prisma + PostgreSQL** API in a routes → controllers → services
layout (services use Prisma directly), a **React + Vite + shadcn/ui** back-office frontend, and a **shared Zod
DTO** package — wired together with Turborepo and npm workspaces, and set up for AI coding agents (Claude Code and
Codex) through `AGENTS.md` and `.agents/skills/`.

## What you get

| Area          | Included                                                                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend       | Fastify 5, Zod-validated routes with generated OpenAPI (`/docs`), JWT auth with refresh-token rotation, users CRUD (soft delete), audit log, health check                   |
| Data          | Prisma 7 with the pg adapter, services returning Prisma model types, ambient unit-of-work transactions, gapless running numbers, unique-race → 409 mapping, idempotent seed |
| Frontend      | React 19, Tailwind 4, shadcn/ui, sign-in, sidebar layout, dark mode, data table with search/filters/pagination, Tags / Users / Audit log pages                              |
| Shared        | `@repo/shared`: request/response Zod schemas and error codes used by both apps                                                                                              |
| Quality       | Jest unit tests (80% coverage gate) + Testcontainers integration tests, ESLint, Prettier, strict TypeScript                                                                 |
| Delivery      | Dockerfile (turbo prune), GitHub Actions: CI on PRs, Cloud Run deploy on `main`, optional AI PR review                                                                      |
| Agent tooling | `AGENTS.md` + skills: `fastify-zod`, `unit-test-mocks`, `prisma-raw-query`, `prd`, `spec-analysis`/`spec-create`/`spec-run`, `commit`, `pr`                                 |

The **tags** feature is an example domain: the smallest complete slice (`tag.routes.ts` → `tag.controller.ts` → `tag.service.ts`).
Copy it for your first real feature, then delete it.

## Quick start

Requirements: Node 22 (≥ 18 works), npm 10, Docker (for Postgres and integration tests).

```bash
npm install
docker run -d --name app-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app -p 5432:5432 postgres:16-alpine
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
npm run build                                   # builds @repo/shared and generates the Prisma client
(cd apps/backend && npx prisma migrate dev && npx prisma db seed)   # prints the admin password once
npm run dev
```

- Frontend: http://localhost:5173 — sign in as `admin` with the printed password
- API docs: http://localhost:3000/docs

## Using this template

1. **Create the repo** from this template (GitHub "Use this template", or copy the folder and `git init`).
2. **Rename** — search and replace:
   - `monorepo-csr-template` → your repo name (root `package.json`)
   - `@app/backend` / `@app/frontend` → your package scope (`apps/*/package.json`, `Dockerfile`,
     `.github/workflows/ci.yml`, `AGENTS.md`, `.agents/skills/spec-run/SKILL.md`)
   - `APP_NAME` in `apps/frontend/src/constants/index.ts`, `<title>` in `apps/frontend/index.html`, the Swagger title
     in `apps/backend/src/server.ts`
3. **Describe the product** in the first paragraph of `AGENTS.md` and in `docs/prd/README.md`.
4. **Regenerate the lockfile** after renaming: `rm package-lock.json && npm install`.
5. **Build your first domain** by copying the tag files (the `fastify-zod` skill lists every file), then remove the
   example: `tag.routes.ts`, `tag.controller.ts`, `tag.service.ts` and their tests, their lines in `server.ts` and
   `routes/__tests__/routes.test.ts`, the shared tag DTOs, the `Tag` model and `TAG` enum values (new migration — or, before your first deploy, reset and regenerate the
   init migration), the Tags nav entry, and `docs/prd/03-tags.md` with its routing row in `.agents/skills/prd/SKILL.md`.
6. **Configure deployment** (below) or delete `.github/workflows/deploy.yml`.

## Repository layout

```
apps/backend      Fastify API: src/routes → src/controllers → src/services (Prisma), src/middlewares, src/common
apps/frontend     React back office (HashRouter, shadcn/ui)
packages/shared   Zod DTOs + ERROR_CODE shared by both apps
packages/eslint-config
docs/prd          product requirement docs (business audience)
docs/specs        dated implementation specs
.agents/skills    agent skills (.claude/skills → symlink)
```

`AGENTS.md` is the engineering guide — conventions, checklists and gotchas. Read it before changing code.

## Common commands

```bash
npm run dev                                  # everything in watch mode
npm run build                                # shared → backend → frontend
npm run lint
npm run format
npm test -w @app/backend                     # unit tests
npm run test:coverage -w @app/backend
npm run test:integration -w @app/backend     # needs Docker
```

## Deployment

`Dockerfile` builds a backend-only image that runs `prisma migrate deploy` and starts the API on port 3000. The
frontend is a static build (`apps/frontend/dist`) — host it on any static host and set `VITE_API_BASE_URL` at build
time.

`.github/workflows/deploy.yml` builds the image and deploys it to Google Cloud Run on every push to `main` that touches
the backend or shared code. It is skipped until you configure:

- Repository **variables**: `PROJECT_ID`, `REGION`, `REPOSITORY` (Artifact Registry), `SERVICE` (Cloud Run service)
- Repository **secrets**: `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT` (Workload Identity Federation)
- A GitHub environment named `deploy-prod`
- On the Cloud Run service: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (your frontend origin)

`.github/workflows/pr-review.yml` runs an AI review when a PR gets the `ai-pr-review` label (needs the
`OPENROUTER_API_KEY` secret); delete it if you don't want it.
