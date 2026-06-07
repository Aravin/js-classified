# js-classified / locful.com — Developer Guide

India-focused classified ads platform. Yarn monorepo with three packages: `client` (SvelteKit SPA), `server` (Fastify REST API), `db` (Prisma + PostgreSQL).

See `docs/architecture.md` for full system diagrams, DB ERD, auth flows, and deployment topology.

---

## Monorepo Layout

```
js-classified/
├── client/          SvelteKit frontend
├── server/          Fastify REST API
├── db/              Prisma schema + migrations (source of truth)
├── docs/            architecture.md + seed data files
├── llms.txt         LLM context index (llms.txt spec)
└── package.json     Yarn workspaces root
```

## Commands

### Root (run from repo root)
```bash
yarn install           # install all workspace dependencies
```

### Client
```bash
cd client
yarn dev               # vite dev server (default :5173)
yarn build             # production build
yarn check             # svelte-check type checking
yarn lint              # prettier + eslint
yarn lint:fix          # auto-fix lint issues
yarn format            # prettier write
```

### Server
```bash
cd server
yarn dev               # ts-node-dev watch mode
yarn build             # tsc → dist/
yarn start             # node dist/index.js
yarn lint              # eslint
yarn lint:fix
yarn format
```

### Database
```bash
cd db
npx prisma migrate dev          # run pending migrations + regenerate client
npx prisma migrate deploy       # apply migrations in production
npx prisma db seed              # seed locations + categories
npx prisma studio               # GUI at localhost:5555
npx prisma generate             # regenerate Prisma client without migrating
```

---

## Environment Setup

Copy `.env.example` to `.env` in both `client/` and `server/` before running.

### Required server env vars
```
DATABASE_URL=postgresql://...
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_AUDIENCE=https://api.locful.com
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Required client env vars
```
PUBLIC_API_URL=http://localhost:8080
PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
PUBLIC_AUTH0_CLIENT_ID=...
PUBLIC_AUTH0_CALLBACK_URL=http://localhost:5173
PUBLIC_AUTH0_AUDIENCE=https://api.locful.com
```

---

## Architecture

### Stack
| Layer | Technology |
|-------|-----------|
| Frontend | SvelteKit ^2 + Svelte ^5 + TailwindCSS + DaisyUI |
| Backend | Fastify ^5 + TypeScript |
| ORM | Prisma ^6 |
| Database | PostgreSQL |
| Auth | Auth0 (JWKS-RSA / RS256 JWT) |
| Images | Cloudinary v2 |
| Email | SendGrid or SMTP (daily reports) |
| Hosting | Google Cloud Run (asia-southeast1) |

### Request flow
```
Browser (SvelteKit SPA)
  → HTTPS REST/JSON
  → Fastify API (Cloud Run)
    → Helmet/CORS/rate-limit plugins
    → SQL injection detection middleware
    → [Auth0 JWT verification if protected route]
    → [Ownership check if owner-only route]
    → Zod schema validation
    → Prisma ↔ PostgreSQL
```

### API base URLs
- Development: `http://localhost:8080`
- Production: `https://api.locful.com` or `https://locful.com/api`

Routes are registered with **both** `/api/*` and `/*` prefixes — same handlers, dual prefix for domain flexibility.

---

## Key Files

### Server
| File | Purpose |
|------|---------|
| `server/index.ts` | Entry: plugin registration, route mounting, health check, cron endpoint |
| `server/config/config.ts` | All env vars parsed + startup validation |
| `server/middleware/auth.ts` | Auth0 JWT verification (JWKS-RSA) — attaches `request.user` |
| `server/middleware/security.ts` | Injection detection, structured error logging |
| `server/api/routes/listing.routes.ts` | Listings CRUD + publish + contact reveal |
| `server/api/routes/image.routes.ts` | Image upload (multipart), delete, reorder |
| `server/api/routes/user.routes.ts` | User upsert on login, profile update/delete |
| `server/services/storage.factory.ts` | Storage provider factory (`STORAGE_PROVIDER` env) |
| `server/services/image.service.ts` | Upload/delete orchestration via storage provider |
| `server/plugins/security.ts` | Registers @fastify/cors, @fastify/helmet, @fastify/rate-limit |

### Client
| File | Purpose |
|------|---------|
| `client/src/lib/auth/auth0.ts` | Auth0 SPA SDK wrapper + 4 Svelte stores |
| `client/src/lib/types.ts` | Shared TypeScript types (Listing, User, Category, Location, Image) |
| `client/src/lib/config.ts` | All PUBLIC_ env vars in one typed object |
| `client/src/lib/stores/filters.ts` | Writable stores: selectedLocation, selectedCategory, searchQuery |
| `client/src/lib/form-validation.ts` | Validation + DOMPurify sanitization + profanity filter |
| `client/src/routes/+layout.svelte` | Global header, search bar, footer |
| `client/src/routes/post-ad/` | Multi-step ad creation + preview |
| `client/src/routes/my-ads/` | User dashboard: activate/pause/delete listings |

### Database
| File | Purpose |
|------|---------|
| `db/schema.prisma` | Canonical schema — models: location, category, user, listing, image |
| `db/prisma/seed.ts` | Seeds 129k+ locations + category tree |
| `db/migrations/` | 7 migration snapshots |

---

## Database Models (quick ref)

```
location   id, name, dist, state, state_code, pincode, loc_type, coords
category   id, name, slug, parent_category_id (self-ref tree)
user       id, userId(Auth0 sub), username, email, phone, fullName, avatar
listing    id, title, slug, description, email*, phone*, price, status, categoryId, locationId, userId
image      id, path, thumbnailPath, order(0=cover), listingId
```
`* email/phone on listing are masked in public API responses`

### ListingStatus enum
`DRAFT → ACTIVE ↔ DRAFT (pause/resume) → ENDED | SUSPENDED | DELETED`

---

## Auth Pattern

- Identity provider: **Auth0 only** — no local passwords stored
- Client: `loginWithPopup()`, ID token stored in localStorage, sent as `Authorization: Bearer <token>`
- Server: verifies JWT via JWKS (`RS256`), attaches decoded payload to `request.user`
- On login: client POSTs to `POST /api/users` to upsert user record in PostgreSQL

### Adding a protected route (server)
```typescript
import { verifyAuth0Token } from '../../middleware/auth';

fastify.get('/protected', { preHandler: verifyAuth0Token }, async (request, reply) => {
  const user = request.user; // decoded Auth0 JWT payload
  // ...
});
```

### Ownership check pattern
```typescript
// Verify listing belongs to the authenticated user
const listing = await prisma.listing.findFirst({
  where: { id: listingId, user: { userId: request.user.sub } }
});
if (!listing) return reply.code(403).send({ error: 'Forbidden' });
```

---

## Adding a New API Endpoint

1. Add Zod schema in `server/api/schemas/`
2. Add handler in the relevant route file (`listing.routes.ts`, `image.routes.ts`, `user.routes.ts`)
3. Apply `preHandler: verifyAuth0Token` if auth required
4. Validate body/params/query with Zod in the handler
5. Routes are auto-registered at both `/api/<resource>` and `/<resource>` via dual prefix in `index.ts`

---

## Adding a New Frontend Page

1. Create `client/src/routes/<path>/+page.svelte`
2. Import `authState`, `isAuthenticated` from `$lib/auth/auth0` if the page requires login
3. Use `PUBLIC_API_URL` from `$lib/config` for API calls
4. Add `Authorization: Bearer ${token}` header via `getAuthHeaders()` from `$lib/auth/auth0`

---

## Image Upload Rules

- Max **5 files** per listing, **5 MB** each
- Allowed types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- Cloudinary transformations applied automatically:
  - Full: 1200×800, quality=auto, format=auto
  - Thumbnail: 300×300 webp, quality=80
- `image.order = 0` is the cover/main image

---

## Ad Lifecycle

```
POST /api/listings          → status: DRAFT
POST /api/images/.../images → upload images (need ≥1 to publish)
PATCH /api/listings/:id/publish  → DRAFT → ACTIVE (validates image count + active ad cap)
PATCH /api/listings/:id/status   → toggle ACTIVE ↔ DRAFT
DELETE /api/listings/:id         → DELETED
```

Listings older than `LISTING_EXPIRY_DAYS` (default 30) are automatically excluded from search/browse queries at query time — no scheduled job required.

---

## Security Rules (do not break these)

- Never return `listing.email` or `listing.phone` in list/search/detail responses — use `maskSensitiveData()` helper
- Always check ownership before mutating a listing or its images
- All user inputs must pass through Zod validation server-side
- Client inputs must be sanitized with `sanitizeInput()` (DOMPurify) before submission
- The `/internal/cron/*` endpoint must check `X-Cron-Secret` header — never expose without this

---

## Deployment

- **Backend**: Google Cloud Run (`locful-api`, asia-southeast1) via `server/cloudbuild.yaml`
- **Secrets**: All sensitive env vars injected from Google Secret Manager at deploy time
- **CI**: Push to main → Cloud Build → build Docker image → push GCR → deploy Cloud Run
- **Cron**: Google Cloud Scheduler calls `POST /internal/cron/daily-statistics` daily at 14:30 UTC (8 PM IST)

---

## Code Quality

Pre-commit hooks (Husky + lint-staged) run ESLint + Prettier on staged files automatically.

```bash
# Manual check before committing
cd server && yarn lint
cd client && yarn lint && yarn check
```
