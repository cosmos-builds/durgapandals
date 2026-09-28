# DurgaPandal.com

Turborepo monorepo: `apps/web` (public), `apps/admin`, `apps/api` (Fastify), plus
shared `packages/*`. See `DurgaPandals-V1-Product-UX-Engineering-Spec.md` for
the product spec this implementation follows.

## Stack

- **DB:** MongoDB Atlas + Mongoose (`packages/database`)
- **API:** Fastify (`apps/api`), domain modules per spec §31.6
- **Web/Admin:** Next.js 15 + Tailwind, dark theme only
- **Maps:** MapLibre GL JS + OpenFreeMap tiles (`packages/maps`)
- **Media:** Cloudinary (free tier)
- **Contributor auth:** Email OTP via Resend (`packages/auth`)
- **Admin auth:** JWT session (`packages/auth`)

## First-time setup

```bash
pnpm install

cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
# fill in MONGODB_URI, ADMIN_SESSION_SECRET, RESEND_API_KEY, CLOUDINARY_* in apps/api/.env.local

SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=changeme123 pnpm --filter @durgapandals/api seed

pnpm dev
```

- Web: http://localhost:3000
- Admin: http://localhost:3001
- API: http://localhost:4000
