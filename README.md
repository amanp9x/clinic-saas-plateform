# Clinic SaaS Platform

A web-based healthcare platform (Practo-inspired) whose core differentiator is a
**manually staff-controlled live doctor queue and delay tracker** — no AI prediction,
just deterministic business rules driven by receptionist/clinic-staff input, pushed to
patients in real time over Socket.IO.

Built in phases. Completed so far:

- **Phase 0** — technical foundation (monorepo, auth scaffolding, Socket.IO transport)
- **Phase 1** — full authentication module (JWT, sessions/devices, OTP, password reset, RBAC)
- **Phase 2** — public landing website (doctor/clinic/hospital search & profiles, SEO)

Not yet built: dashboards (patient/doctor/reception/admin), appointment booking, the live
queue/delay-tracking module itself, telemedicine, EMR, prescriptions, labs, pharmacy,
payments, and analytics.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · TanStack Query · React Hook Form · Zod |
| Backend | Node.js · Express · TypeScript · Prisma ORM · PostgreSQL · Redis (ioredis) · Socket.IO |
| Auth | JWT (access + rotating refresh tokens), bcrypt, OTP (email/mobile), RBAC, audit logging |
| Tooling | pnpm workspaces monorepo · ESLint 9 (flat config) · Prettier · Vitest + Supertest · tsup (API bundling) |

## Repository layout

```
apps/
  web/                  Next.js frontend
    src/app/(marketing)/   Public site: home, doctors, clinics, hospitals, about, contact, faq, legal
    src/app/(auth)/         Login, register, OTP login, forgot/reset password, verify email
    src/app/account/        Protected account settings (sessions, change password)
    src/components/ui/      shadcn/ui primitives
    src/components/auth/    Auth forms, route guards
    src/components/marketing/ Landing-site cards, sections, search/filter UI
    src/hooks/               useAuth, auth mutations, sessions, useQueueSocket
    src/lib/                 api-client (authenticated fetch + refresh flow), catalog-api
                              (server-only public data fetchers), env, format helpers
    src/proxy.ts              Route-protection gate (Next 16's middleware.ts equivalent)
  api/                  Express backend
    src/config/            env validation (zod), Prisma client, Redis client, logger, Socket.IO
    src/middleware/         auth, RBAC, validation, rate limiting, error handling
    src/modules/auth/       register/login/refresh/logout/OTP/password/sessions
    src/modules/catalog/    public doctor/clinic/hospital/specialization search + profiles
    src/modules/contact/    contact form submission
    src/sockets/            /queue namespace: JWT handshake auth + clinic-room authorization
    src/utils/              AppError hierarchy, API response envelope, JWT, password, slugify
    prisma/schema.prisma    Identity, session/auth, and public-catalog entities
    prisma/seed.ts          Sample specializations, doctors, clinics, hospitals, reviews,
                             testimonials, articles
    tests/                  Vitest + Supertest (48 tests)
packages/
  shared/                Types/enums/validation schemas shared by both apps — ships a real
                         `tsc` build (`pnpm --filter @clinic/shared build`) since Next's
                         bundler can't resolve raw NodeNext-style TS source from a workspace
                         package the way `tsx`/`esbuild` can
docker-compose.yml       Local Postgres + Redis for development
```

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`corepack enable` or `npm i -g pnpm`)
- PostgreSQL 16 and Redis 7 — either via `docker compose up -d`, or your own local instances

## Getting started

```bash
# 1. Install dependencies (installs all workspaces)
pnpm install

# 2. Start Postgres + Redis (skip if you already have them running)
docker compose up -d

# 3. Configure environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 4. Build the shared package, generate the Prisma client, and run migrations
pnpm build:shared
pnpm db:generate
pnpm db:migrate

# 5. Seed sample doctors/clinics/hospitals/reviews (safe to re-run)
pnpm db:seed

# 6. Run both apps in dev mode
pnpm dev
#    web: http://localhost:3000
#    api: http://localhost:4000
```

> `pnpm dev` and `pnpm build` already build `packages/shared` first — the manual
> `pnpm build:shared` step above is only needed the very first time, before `pnpm dev`
> has run once.

### Required environment variables

`apps/api/.env` (see `apps/api/.env.example` for the full list):

- `DATABASE_URL`, `REDIS_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` — set these to random
  32+ byte strings (`openssl rand -hex 32`), never reuse the placeholders
- `CORS_ORIGIN` — the web app's origin
- `SMTP_*` / `SMS_*` — optional; when unset, OTP codes and emails are logged instead of sent
  (fine for local dev — check the API server's console output for codes)

`apps/web/.env`:

- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_SITE_URL`

Payment (Razorpay) and object storage (S3/Cloudinary-style) variables are present as
placeholders in `apps/api/.env.example` and only need real values once those modules
are implemented.

**Note:** the marketing home page uses ISR (`next: { revalidate }`) and fetches catalog
data at build time, so `pnpm build:web` / `pnpm build` requires the API to be reachable
at `NEXT_PUBLIC_API_URL` during the build — the same constraint any Next.js app has when
statically generating pages backed by a headless API.

## Commands

Run from the repo root (they fan out to the workspace packages):

| Command | Description |
| --- | --- |
| `pnpm dev` | Build shared, then run web + api concurrently in watch mode |
| `pnpm build` | Production build of shared + both apps (topologically ordered) |
| `pnpm lint` | ESLint across all packages |
| `pnpm type-check` | `tsc --noEmit` across all packages |
| `pnpm test` | Vitest (API, 48 tests) — web has no tests yet |
| `pnpm format` | Prettier write |
| `pnpm db:generate` / `db:migrate` / `db:seed` / `db:studio` | Prisma client generation, migrations, sample data, Studio |

Per-app: `pnpm dev:web`, `pnpm dev:api`, `pnpm build:web`, `pnpm build:api`, `pnpm start:web`, `pnpm start:api`.

## Notable engineering decisions

- **Refresh-token reuse detection**: presenting an already-rotated refresh token revokes
  the entire session rather than just rejecting the request — a stolen-token defense.
  JWTs carry a `jti` claim so two tokens signed in the same second are never identical.
- **Sessions are stable across token rotation**: a `Session` row (not the `RefreshToken`
  row) is the identity referenced by the JWT `sessionId` claim, so "sign out this device"
  in the UI reflects one row per login, not one per token refresh.
- **OTP rate-limiting is Postgres-backed**, not Redis — Redis has no other consumer yet,
  so this avoids a hard dependency on it for a core auth flow.
- **The Doctor Profile's live-queue section is an honest "not started" state.** No queue
  or receptionist-dashboard module exists yet (that's explicitly a separate, later phase),
  so rather than fabricate a token/wait-time number, the API always returns
  `{ isActive: false }` and the UI displays that plainly. The homepage's "Live Queue
  Feature Showcase" section is clearly labeled as an illustrative example, not live data.
- **`packages/shared` ships a real build.** Its internal imports use NodeNext-style `.js`
  specifiers (needed for `apps/api`'s `tsc`/`tsup` toolchain), which Next's Turbopack
  bundler cannot resolve from raw `.ts` source pulled in via `transpilePackages` — so the
  package now compiles to `dist/` and both apps consume that.
