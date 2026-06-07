# server — Fastify REST API

Fastify ^5 REST API for locful.com. TypeScript, Prisma + PostgreSQL, Auth0 JWT verification, Cloudinary image storage.

---

## Commands

```bash
yarn dev          # ts-node-dev watch mode → http://localhost:8080
yarn build        # tsc → dist/
yarn start        # node dist/index.js (production)
yarn lint         # eslint
yarn lint:fix     # eslint --fix
yarn format       # prettier --write
```

---

## Environment Variables

Copy `.env.example` to `.env`:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/locful
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_AUDIENCE=https://api.locful.com
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
PORT=8080
HOST=::
CORS_ORIGINS=http://localhost:5173
LISTING_EXPIRY_DAYS=30
STORAGE_PROVIDER=cloudinary
EMAIL_ENABLED=false
CRON_DAILY_REPORT_ENABLED=false
```

All vars are validated at startup in `config/config.ts` — the server exits if required vars are missing.

---

## Directory Layout

```
server/
├── index.ts                     Entry point — register plugins, routes, health, cron
├── api/
│   ├── routes/
│   │   ├── listing.routes.ts    Listings CRUD + publish + contact reveal
│   │   ├── image.routes.ts      Image upload (multipart), delete, reorder
│   │   └── user.routes.ts       User upsert on login, profile CRUD
│   └── schemas/
│       ├── listing.schema.ts    Zod schemas for listing endpoints
│       ├── upload.schema.ts     Zod schemas for image upload
│       └── user.schema.ts       Zod schemas for user endpoints
├── middleware/
│   ├── auth.ts                  Auth0 JWT verification via JWKS-RSA
│   ├── security.ts              Injection detection, logging, error handler
│   ├── fileValidation.ts        MIME type + extension whitelist
│   └── validation.ts            Zod helpers, SSRF URL validator
├── plugins/
│   └── security.ts              Registers CORS, Helmet, rate-limit (100 req/min)
├── config/
│   ├── config.ts                Typed env-var config object + startup validation
│   └── security.ts              Security config, HTTPS enforcement
├── services/
│   ├── image.service.ts         Orchestrates upload/delete via storage provider
│   ├── storage.interface.ts     StorageProvider interface
│   ├── storage.factory.ts       Factory: cloudinary | s3 (stub) | r2 (stub)
│   ├── providers/
│   │   └── cloudinary.provider.ts  Cloudinary v2 implementation
│   ├── email.service.ts         Nodemailer / SendGrid daily reports
│   └── statistics.service.ts   Daily stats queries
├── Dockerfile                   Multi-stage Node 22 Alpine build
└── cloudbuild.yaml              GCP Cloud Build → Cloud Run deploy pipeline
```

---

## API Route Map

All routes registered twice: `/api/<resource>` **and** `/<resource>` (dual prefix for domain flexibility).

### Listings (`listing.routes.ts`)
| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/listings` | No | List/search (paginated). Query: `q`, `categoryId`, `locationId`, `hasImages`, `page`, `limit`, `sortBy`, `order` |
| GET | `/api/listings/:id` | No | Listing detail. Email/phone masked. |
| GET | `/api/listings/:id/contact` | **Yes** | Reveal seller email/phone |
| GET | `/api/listings/user/:userId` | **Yes** | User's own listings |
| POST | `/api/listings` | **Yes** | Create listing → status: DRAFT |
| PATCH | `/api/listings/:id` | **Yes (owner)** | Update fields |
| PATCH | `/api/listings/:id/publish` | **Yes (owner)** | DRAFT → ACTIVE |
| PATCH | `/api/listings/:id/status` | **Yes (owner)** | Toggle ACTIVE ↔ DRAFT |
| DELETE | `/api/listings/:id` | **Yes (owner)** | Soft delete → DELETED |

### Images (`image.routes.ts`)
| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| POST | `/api/images/listings/:id/images` | **Yes (owner)** | Upload images (multipart, max 5 × 5MB) |
| DELETE | `/api/images/listings/:id/images/:imageId` | **Yes (owner)** | Delete image |
| PATCH | `/api/images/listings/:id/images/reorder` | **Yes (owner)** | Reorder images |

### Users (`user.routes.ts`)
| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/users/:id` | No | Public user profile |
| POST | `/api/users` | **Yes** | Create/upsert user on login |
| PATCH | `/api/users/:id` | **Yes (owner)** | Update profile |
| DELETE | `/api/users/:id` | **Yes (owner)** | Delete account |

### System
| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/health` | No | `{ status: 'ok', timestamp }` |
| GET | `/health?checks=true` | No | Deep check: DB + Cloudinary |
| POST | `/internal/cron/daily-statistics` | `X-Cron-Secret` header | Trigger daily email report |

---

## Middleware Chain

```
Request
  → Security plugin (Helmet headers, CORS, rate-limit 100/min)
  → validateInputMiddleware (SQL/XSS injection detection in URL)
  → Route handler
    → [preHandler: verifyAuth0Token]   ← if route is protected
    → [ownership check]                ← if route is owner-only
    → Zod.parse(body/params/query)
    → Business logic + Prisma
    → Response
```

---

## Adding a Protected Route

```typescript
import { verifyAuth0Token } from '../../middleware/auth';

// Authenticated — any logged-in user
fastify.get('/protected', { preHandler: verifyAuth0Token }, async (request, reply) => {
  const user = request.user; // decoded Auth0 JWT payload (sub, email, etc.)
});

// Owner-only — must also verify resource belongs to user
const listing = await prisma.listing.findFirst({
  where: { id: listingId, user: { userId: request.user.sub } }
});
if (!listing) return reply.code(403).send({ error: 'Forbidden' });
```

---

## Adding a New Endpoint

1. Add Zod schema in `api/schemas/<resource>.schema.ts`
2. Add handler in the relevant route file
3. Apply `preHandler: verifyAuth0Token` if auth required
4. Validate with Zod: `const body = schema.parse(request.body)`
5. Routes register automatically at both prefixes via `index.ts`

---

## Auth0 JWT Verification (`middleware/auth.ts`)

- Fetches and caches JWKS from `https://{AUTH0_DOMAIN}/.well-known/jwks.json`
- Supports **both** ID tokens (aud = `CLIENT_ID`) and access tokens (aud starts with `http`)
- Rejects opaque tokens (5-part JWTs) with a clear error
- Algorithm: `RS256` only
- Attaches decoded payload to `request.user`

---

## Contact Privacy Rule

**Never** return `listing.email` or `listing.phone` in list/search/detail responses. Always call `maskSensitiveData()`:

```typescript
import { maskSensitiveData } from './listing.routes';

// Returns listing with email/phone removed, hasEmail/hasPhone booleans added
const safe = maskSensitiveData(listing);
```

Contact info is only returned from `GET /api/listings/:id/contact` — which requires `verifyAuth0Token`.

---

## Image Upload Rules

- Max **5 files** per listing, **5 MB** each
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- Allowed extensions: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`
- Cloudinary transforms: full (1200×800 quality=auto), thumb (300×300 webp quality=80)
- `image.order = 0` is the cover/main image

---

## Storage Provider

Swap providers via `STORAGE_PROVIDER` env var:

```typescript
// storage.factory.ts — returns a StorageProvider instance
'cloudinary' → CloudinaryProvider (fully implemented)
's3'         → (stub — throws NotImplemented)
'r2'         → (stub — throws NotImplemented)
```

To add a new provider: implement `StorageProvider` interface in `services/providers/` and register in `storage.factory.ts`.

---

## Security Notes

- Rate limiting: 100 req/min per IP (`plugins/security.ts`)
- Helmet adds HSTS, XSS protection, content-type headers
- SSRF protection: `validateUrl()` in `middleware/validation.ts` rejects private/loopback IPs
- Injection detection: `validateInputMiddleware` scans URL path for SQL/XSS patterns
- Cron endpoint: always requires `X-Cron-Secret` header matching `CRON_JOB_SECRET` env var

---

## Deployment

```bash
# Build Docker image
docker build -f Dockerfile ..   # context is repo root (needs db/schema.prisma)

# Cloud Run deploy (done by cloudbuild.yaml on push to main)
gcloud run deploy locful-api \
  --image gcr.io/.../locful-api:$SHA \
  --region asia-southeast1 \
  --memory 512Mi --cpu 1 \
  --set-secrets DATABASE_URL=...,CLOUDINARY_API_KEY=...
```

Health check: `GET /health` — Cloud Run uses this to determine instance readiness.
