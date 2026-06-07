# locful.com — Architecture & Technical Reference

> **Repo name:** `js-classified` | **Brand:** locful.com | **Company:** exaful.com

---

## Table of Contents

1. [Overview](#1-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Tech Stack](#3-tech-stack)
4. [System Architecture](#4-system-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Database Schema](#7-database-schema)
8. [Authentication & Authorization Flow](#8-authentication--authorization-flow)
9. [Ad Lifecycle Flow](#9-ad-lifecycle-flow)
10. [Image Upload Flow](#10-image-upload-flow)
11. [Search Flow](#11-search-flow)
12. [Deployment Architecture](#12-deployment-architecture)
13. [CI/CD Pipeline](#13-cicd-pipeline)
14. [Configuration Reference](#14-configuration-reference)
15. [Security Design](#15-security-design)
16. [Key Design Decisions](#16-key-design-decisions)

---

## 1. Overview

locful.com is a **classified ads platform** for India. Users can post, browse, and search listings across categories (vehicles, jobs, real estate, etc.) for 129k+ Indian cities and villages.

**Core capabilities:**
- Post free classified ads with images
- Browse by category and location
- Full-text search with filters
- Auth0-based authentication (social login)
- Contact privacy — seller details revealed only to logged-in users
- Google Shopping / Schema.org structured data for SEO

---

## 2. Monorepo Structure

```
js-classified/
├── client/          SvelteKit frontend (locful.com)
├── server/          Fastify REST API
├── db/              Prisma schema + migrations (source of truth)
├── docs/            Data files + architecture docs
├── package.json     Yarn workspaces root
└── .lintstagedrc.json
```

Workspaces are managed with **Yarn** (`workspaces: ["client", "server", "db"]`).  
Pre-commit hooks via **Husky + lint-staged** run ESLint + Prettier on staged files.

---

## 3. Tech Stack

### Backend (`server/`)

| Concern         | Library / Tool          | Version  |
|-----------------|-------------------------|----------|
| Runtime         | Node.js                 | 22 (LTS) |
| Framework       | Fastify                 | ^5.1.0   |
| Language        | TypeScript              | ^5.6.3   |
| ORM             | Prisma                  | ^6.18.0  |
| Database        | PostgreSQL               | —        |
| Auth validation | jwks-rsa + jsonwebtoken | ^3.2.0   |
| Image storage   | Cloudinary v2           | ^2.5.1   |
| Email           | Nodemailer + SendGrid   | —        |
| Validation      | Zod                     | ^4.1.12  |
| CORS / Headers  | @fastify/helmet + cors  | —        |
| Rate limiting   | @fastify/rate-limit     | —        |
| File upload     | @fastify/multipart      | ^9.0.1   |

### Frontend (`client/`)

| Concern        | Library / Tool          | Version   |
|----------------|-------------------------|-----------|
| Framework      | SvelteKit               | ^2.47.3   |
| UI language    | Svelte                  | ^5.42.2   |
| Styling        | TailwindCSS + DaisyUI   | ^3 / ^4   |
| Icons          | @iconify/svelte         | ^5.0.2    |
| Auth           | @auth0/auth0-spa-js     | ^2.7.0    |
| Sanitization   | DOMPurify               | ^3.3.0    |
| Profanity      | bad-words               | ^4.0.0    |
| DnD (images)   | svelte-dnd-action       | ^0.9.65   |
| Build          | Vite                    | ^5.4.21   |

---

## 4. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          Browser                                 │
│                                                                  │
│   SvelteKit SPA (locful.com)                                     │
│   ┌───────────┐  ┌──────────┐  ┌────────────┐  ┌─────────────┐ │
│   │ Homepage  │  │ Search   │  │ List Detail│  │ Post Ad     │ │
│   └───────────┘  └──────────┘  └────────────┘  └─────────────┘ │
│                                                                  │
│   Auth0 SPA SDK  ←──────────────────┐                           │
└────────────┬────────────────────────┼────────────────────────────┘
             │ HTTPS REST (JSON)      │ Auth (popup / token refresh)
             ▼                        ▼
┌─────────────────────┐     ┌─────────────────┐
│  Fastify API Server │     │     Auth0       │
│  (Cloud Run)        │────►│  (Identity)     │
│                     │     └─────────────────┘
│  Routes:            │
│  /api/listings      │     ┌─────────────────┐
│  /api/images        │────►│  Cloudinary     │
│  /api/users         │     │  (Image CDN)    │
│  /internal/cron/*   │     └─────────────────┘
└──────────┬──────────┘
           │ Prisma ORM
           ▼
┌─────────────────────┐     ┌─────────────────┐
│   PostgreSQL DB     │     │  SendGrid/SMTP  │
│   (Cloud SQL / PG)  │     │  (Daily Reports)│
└─────────────────────┘     └─────────────────┘
```

---

## 5. Backend Architecture

### Directory Layout

```
server/
├── index.ts                 Entry point — server setup, plugin/route registration
├── api/
│   ├── routes/
│   │   ├── listing.routes.ts
│   │   ├── image.routes.ts
│   │   └── user.routes.ts
│   └── schemas/
│       ├── listing.schema.ts
│       ├── upload.schema.ts
│       └── user.schema.ts
├── middleware/
│   ├── auth.ts              Auth0 JWT verification (JWKS-RSA)
│   ├── security.ts          Injection detection, structured logging, error handler
│   ├── fileValidation.ts    MIME type + extension validation
│   └── validation.ts        Zod helpers, SSRF URL validator
├── plugins/
│   └── security.ts          Registers CORS, Helmet, rate-limit
├── config/
│   ├── config.ts            All env-var config + startup validation
│   └── security.ts          Security config object, HTTPS enforcement
└── services/
    ├── image.service.ts     Orchestrates upload/delete
    ├── storage.interface.ts StorageProvider interface
    ├── storage.factory.ts   Factory: cloudinary | S3 (stub) | R2 (stub)
    ├── providers/
    │   └── cloudinary.provider.ts
    ├── email.service.ts     Nodemailer / SendGrid
    └── statistics.service.ts Daily stats queries
```

### API Route Map

Routes are registered **twice** — with and without `/api` prefix — to support both `locful.com/api/*` and `api.locful.com/*`:

| Method | Path | Auth Required | Description |
|--------|------|:---:|-------------|
| `GET` | `/api/listings` | No | List/search listings (paginated) |
| `GET` | `/api/listings/:id` | No | Get listing detail (contact masked) |
| `GET` | `/api/listings/:id/contact` | **Yes** | Reveal seller contact info |
| `POST` | `/api/listings` | **Yes** | Create listing (status: DRAFT) |
| `PATCH` | `/api/listings/:id` | **Yes (owner)** | Update listing fields |
| `PATCH` | `/api/listings/:id/publish` | **Yes (owner)** | Transition DRAFT → ACTIVE |
| `PATCH` | `/api/listings/:id/status` | **Yes (owner)** | Change status (pause/activate) |
| `DELETE` | `/api/listings/:id` | **Yes (owner)** | Soft-delete (status: DELETED) |
| `GET` | `/api/listings/user/:userId` | **Yes** | User's own listings |
| `POST` | `/api/images/listings/:id/images` | **Yes (owner)** | Upload images (multipart) |
| `DELETE` | `/api/images/listings/:id/images/:imageId` | **Yes (owner)** | Delete image |
| `PATCH` | `/api/images/listings/:id/images/reorder` | **Yes (owner)** | Reorder images |
| `GET` | `/api/users/:id` | No | Get public user profile |
| `POST` | `/api/users` | **Yes** | Create / upsert user on login |
| `PATCH` | `/api/users/:id` | **Yes (owner)** | Update user profile |
| `DELETE` | `/api/users/:id` | **Yes (owner)** | Delete account |
| `GET` | `/health` | No | Health check |
| `GET` | `/health?checks=true` | No | Deep health (DB + Cloudinary) |
| `POST` | `/internal/cron/daily-statistics` | Secret Header | Trigger daily email report |

### Middleware Stack (per request)

```
Request
  └─► Security Plugin (Helmet, CORS, rate-limit: 100 req/min)
        └─► Injection Detection (SQL/XSS patterns in URL)
              └─► Route Handler
                    └─► [if protected] verifyAuth0Token
                          └─► [if owner-only] ownership check
                                └─► Zod schema validation
                                      └─► Business logic + Prisma
                                            └─► Response
```

---

## 6. Frontend Architecture

### Directory Layout

```
client/src/
├── app.html / app.css / app.d.ts
├── lib/
│   ├── auth/auth0.ts          Auth0 SPA wrapper + 4 Svelte stores
│   ├── categories/            Static category tree (mirrors DB seed data)
│   ├── components/            11 reusable Svelte components
│   │   ├── Header.svelte
│   │   ├── Footer.svelte
│   │   ├── ListingCard.svelte
│   │   ├── ImageUpload.svelte
│   │   ├── CategoryGrid.svelte
│   │   └── ...
│   ├── stores/filters.ts      Writable stores: location, category, search query
│   ├── config.ts              Public env-var config object
│   ├── form-validation.ts     Client validation + DOMPurify sanitization
│   ├── google-integration.ts  Schema.org JSON-LD, Google Shopping feed
│   ├── locations.ts           Static location lookup helpers
│   ├── badwords.ts            Profanity filter wrapper
│   ├── types.ts               Shared TypeScript types
│   └── utils.ts               Helpers (slug, price format, etc.)
└── routes/                    SvelteKit file-system routing
    ├── +layout.svelte         Global header, search bar, footer
    ├── +page.svelte           Homepage
    ├── +error.svelte          Error page
    ├── category/[slug]/       Category browse
    ├── list/[slug]/           Listing detail
    ├── search/                Search results
    ├── post-ad/               Create ad flow + preview
    ├── my-ads/                User dashboard + edit
    ├── settings/              Profile settings
    ├── sitemap.xml/           Dynamic XML sitemap
    └── robots.txt/            Dynamic robots.txt
```

### State Management

```
auth0.ts Svelte stores:
  isAuthenticated  ─── boolean
  user             ─── Auth0 user profile
  auth0Client      ─── Auth0Client instance
  authState        ─── 'loading' | 'authenticated' | 'unauthenticated'

filters.ts Svelte stores:
  selectedLocation ─── { id, name, state }
  selectedCategory ─── { id, slug, name }
  searchQuery      ─── string
```

---

## 7. Database Schema

**Provider:** PostgreSQL via Prisma ORM (`db/schema.prisma`)

### Entity Relationship Diagram

```
┌──────────────┐        ┌───────────────┐        ┌──────────────┐
│   location   │        │    listing    │        │   category   │
├──────────────┤        ├───────────────┤        ├──────────────┤
│ id (PK)      │◄───────│ locationId FK │    ┌───│ id (PK)      │
│ name         │        │ categoryId FK │────┘   │ name         │
│ dist         │        │ userId FK     │────┐   │ slug (uniq)  │
│ state        │        ├───────────────┤    │   │ parent_id FK │──┐
│ state_code   │        │ id (PK)       │    │   └──────────────┘  │
│ country      │        │ title         │    │          ▲          │
│ country_code │        │ slug (uniq)   │    │          └──────────┘
│ pincode      │        │ description   │    │        (self-ref)
│ loc_type     │        │ email*        │    │
│ coords       │        │ phone*        │    │   ┌──────────────┐
│ bbox         │        │ price         │    │   │     user     │
└──────────────┘        │ status        │    └──►├──────────────┤
                        │ createdAt     │        │ id (PK)      │
                        │ updatedAt     │        │ userId (uniq)│
                        └──────┬────────┘        │ username     │
                               │ 1:N             │ email (uniq) │
                               ▼                 │ phone (uniq) │
                        ┌──────────────┐         │ fullName     │
                        │    image     │         │ avatar       │
                        ├──────────────┤         │ createdAt    │
                        │ id (PK)      │         │ updatedAt    │
                        │ path         │         │ lastLogin    │
                        │ thumbnailPath│         └──────────────┘
                        │ order        │
                        │ listingId FK │
                        │ createdAt    │
                        └──────────────┘

* email and phone on listing are masked in public API responses
```

### `ListingStatus` Enum

```
DRAFT ──► ACTIVE ──► ENDED
  ▲          │
  └──────────┘  (pause/resume)

Any status → SUSPENDED (admin)
Any status → DELETED   (user or admin)
```

### Model Details

#### `location`
- 129,181 records seeded from Geoapify data (cities, towns, villages, hamlets)
- `loc_type`: `'city' | 'town' | 'hamlet' | 'village'`
- `coords`: `"lat,lng"` string
- India-specific: `state_code` uses ISO 3166-2 codes

#### `category`
- Self-referential tree (`parent_category_id`)
- Supports two levels: parent → subcategory
- Indexed on `parent_category_id` for efficient tree queries

#### `listing`
- `slug`: `"{title-slugified}-{id}"` — used as the URL identifier
- `price`: `Decimal(10,2)` — stored as exact decimal, displayed as INR
- Expiry enforced at query time (filter: `createdAt > now - expiryDays`), not as a status transition

#### `image`
- `order = 0` is the cover/main image
- `thumbnailPath`: 300×300 webp generated by Cloudinary
- Deleted from Cloudinary (via `storage.provider`) on row delete

### Migration History

```
20241113  init_location_table
20241115  init_category_table
20241116  init_listing_table
20241116  add_slug_to_listing
20241116  add_price_field
20241117  add_draft_status_in_listing_table
20241119  add_user_table
```

---

## 8. Authentication & Authorization Flow

### Login Flow

```
Browser                      Auth0                    Fastify API
   │                            │                          │
   │── loginWithPopup() ───────►│                          │
   │                            │ (social/email login)     │
   │◄── ID Token (JWT) ─────────│                          │
   │                            │                          │
   │── POST /api/users ──────────────── Bearer <ID Token> ►│
   │   { userId, email, ... }   │                          │
   │                            │                  verify JWT via JWKS
   │                            │                  upsert user in DB
   │◄── 200 { user } ───────────────────────────────────── │
   │                            │                          │
   │  (token stored in          │                          │
   │   localStorage)            │                          │
```

### JWT Verification (server-side)

```
Authorization: Bearer <token>
         │
         ▼
   Decode header → extract 'kid'
         │
         ▼
   Fetch JWKS from Auth0
   (https://{AUTH0_DOMAIN}/.well-known/jwks.json)
         │
         ▼
   Verify: algorithm=RS256
           issuer=https://{AUTH0_DOMAIN}/
           audience={CLIENT_ID or AUDIENCE}
           expiry
         │
         ▼
   Attach decoded payload to request.user
```

### Authorization Levels

| Level | Implementation |
|-------|---------------|
| **Public** | No middleware — anyone can read listings/categories/locations |
| **Authenticated** | `preHandler: verifyAuth0Token` — valid JWT required |
| **Owner-only** | Auth + DB check that `listing.userId == request.user.sub` |
| **Internal** | `X-Cron-Secret` header matches `CRON_JOB_SECRET` env var |

---

## 9. Ad Lifecycle Flow

```
User fills Post-Ad form
        │
        ▼
POST /api/listings
  ─ status: DRAFT
  ─ title, description, price, category, location, contact
        │
        ▼
POST /api/images/listings/:id/images (multipart, up to 5 × 5MB)
  ─ Cloudinary resize: 1200×800
  ─ Cloudinary thumbnail: 300×300 webp
  ─ image rows saved with order (0 = cover)
        │
        ▼
User previews listing
        │
        ▼
PATCH /api/listings/:id/publish
  ─ validates: at least 1 image
  ─ validates: active ads count < PUBLIC_MAX_ACTIVE_ADS
  ─ status: DRAFT → ACTIVE
        │
        ▼
Listing visible in search/browse
  ─ expires after LISTING_EXPIRY_DAYS (default 30) days
  ─ expiry filtered at query time, no cron needed

        ┌─────────────────────┐
        │  User can later:    │
        │  Pause  → DRAFT     │
        │  Resume → ACTIVE    │
        │  Delete → DELETED   │
        └─────────────────────┘
```

---

## 10. Image Upload Flow

```
Browser (ImageUpload.svelte)
        │
        │  multipart/form-data (max 5 files, 5MB each)
        ▼
Fastify → fileValidation middleware
        │  checks: MIME type + file extension whitelist
        ▼
ImageService.uploadImage()
        │
        ▼
StorageFactory.getProvider()   ← reads STORAGE_PROVIDER env
        │
        ├── 'cloudinary' → CloudinaryProvider
        ├── 's3'         → (stub, throws NotImplemented)
        └── 'r2'         → (stub, throws NotImplemented)
                │
                ▼ (Cloudinary path)
        cloudinary.uploader.upload_stream()
          transformation:
            - full: width=1200, height=800, crop=limit, quality=auto, format=auto
            - thumb: width=300, height=300, crop=fill, format=webp, quality=80
                │
                ▼
        Returns { path, thumbnailPath }
                │
                ▼
        Prisma: create image row
        { path, thumbnailPath, order, listingId }
```

---

## 11. Search Flow

```
User types query + selects filters
(searchQuery store, selectedLocation store, selectedCategory store)
        │
        ▼
GET /api/listings?q=...&locationId=...&categoryId=...
                 &page=1&limit=20&sortBy=createdAt&order=desc
                 &hasImages=true
        │
        ▼
Fastify handler builds Prisma where clause:
  ┌─────────────────────────────────────────────┐
  │  status: ACTIVE                             │
  │  createdAt > (now - expiryDays)             │
  │  title CONTAINS q (case-insensitive) OR     │
  │  description CONTAINS q                     │
  │  categoryId == filter (optional)            │
  │  locationId == filter (optional)            │
  │  images.some() == true (optional)           │
  └─────────────────────────────────────────────┘
        │
        ▼
Prisma: findMany + count (parallel)
        │
        ▼
maskSensitiveData() — strips email/phone, adds hasEmail/hasPhone flags
        │
        ▼
Response: { listings: [...], total, page, limit }
```

---

## 12. Deployment Architecture

### Production

```
                    ┌──────────────────────────────┐
                    │    Google Cloud Platform     │
                    │                              │
  locful.com ──────►│  Cloud CDN / Load Balancer   │
  (SvelteKit SPA)   │         │                    │
                    │         ▼                    │
  api.locful.com ──►│  Cloud Run (locful-api)      │
                    │  Region: asia-southeast1     │
                    │  Memory: 512Mi, 1 vCPU       │
                    │  Container: Node 22 Alpine   │
                    │         │                    │
                    │         ▼                    │
                    │  Cloud SQL (PostgreSQL)      │
                    │  or external PG via URL      │
                    │                              │
                    │  Secret Manager              │
                    │  (all sensitive env vars)    │
                    └──────────────────────────────┘

External services:
  Auth0          ── identity provider (JWKS endpoint)
  Cloudinary     ── image storage + CDN + transformations
  SendGrid       ── transactional email (daily reports)
  Cloud Scheduler── triggers POST /internal/cron/daily-statistics
                    cron: "30 14 * * *" UTC (8 PM IST)
```

### Cloud Run Container

```dockerfile
# Multi-stage build
Stage 1 (builder):  Node 22 Alpine
  - npm ci (all deps)
  - Copy db/schema.prisma
  - prisma generate
  - tsc (compile TypeScript → dist/)

Stage 2 (production): Node 22 Alpine
  - Copy: node_modules (prod only), dist/, prisma client
  - User: nodejs (uid 1001, non-root)
  - PORT: 8080
  - HEALTHCHECK: GET /health every 30s
  - NODE_OPTIONS: --max-old-space-size=400
```

### Networking

| Origin | Destination | Protocol |
|--------|------------|---------|
| Browser | locful.com | HTTPS |
| Browser | api.locful.com | HTTPS (REST/JSON) |
| Browser | Auth0 | HTTPS (OIDC popup) |
| Cloud Run | Auth0 JWKS | HTTPS (JWT verify) |
| Cloud Run | Cloud SQL | TCP (private VPC) |
| Cloud Run | Cloudinary | HTTPS |
| Cloud Run | SendGrid | HTTPS |
| Cloud Scheduler | Cloud Run `/internal/cron/...` | HTTPS + X-Cron-Secret |

---

## 13. CI/CD Pipeline

```
Developer pushes to main branch
        │
        ▼
Google Cloud Build (cloudbuild.yaml)
        │
        ├── Step 1: docker build
        │     --cache-from gcr.io/.../locful-api:latest
        │     --tag gcr.io/.../locful-api:$SHORT_SHA
        │     --tag gcr.io/.../locful-api:latest
        │
        ├── Step 2: docker push (both tags)
        │
        └── Step 3: gcloud run deploy locful-api
              --image gcr.io/.../locful-api:$SHORT_SHA
              --region asia-southeast1
              --memory 512Mi
              --cpu 1
              --set-secrets (DATABASE_URL, CLOUDINARY_*, AUTH0_*, ...)
              --set-env-vars EMAIL_ENABLED=true, EMAIL_PROVIDER=sendgrid, ...

Build timeout: 1200s
```

---

## 14. Configuration Reference

### Server Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `AUTH0_DOMAIN` | Yes | — | Auth0 tenant domain |
| `AUTH0_CLIENT_ID` | Yes | — | SPA client ID (ID token audience) |
| `AUTH0_AUDIENCE` | Yes | — | API audience (access token) |
| `CLOUDINARY_CLOUD_NAME` | Yes | — | Cloudinary account |
| `CLOUDINARY_API_KEY` | Yes | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | — | Cloudinary API secret |
| `PORT` | No | `8080` | Server listen port |
| `HOST` | No | `::` | Listen host (IPv6 any) |
| `CORS_ORIGINS` | No | `*` | Comma-separated allowed origins |
| `LISTING_EXPIRY_DAYS` | No | `30` | Days before listing expires |
| `STORAGE_PROVIDER` | No | `cloudinary` | `cloudinary` / `s3` / `r2` |
| `EMAIL_ENABLED` | No | `false` | Enable email reporting |
| `EMAIL_PROVIDER` | No | `smtp` | `smtp` or `sendgrid` |
| `SENDGRID_API_KEY` | Conditional | — | Required if `EMAIL_PROVIDER=sendgrid` |
| `EMAIL_FROM` | Conditional | — | Sender address |
| `EMAIL_TO` | Conditional | — | Recipient address |
| `CRON_DAILY_REPORT_ENABLED` | No | `false` | Enable cron endpoint |
| `CRON_JOB_SECRET` | Conditional | — | Required if cron enabled |

### Client Environment Variables

| Variable | Description |
|----------|-------------|
| `PUBLIC_API_URL` | Backend base URL |
| `PUBLIC_AUTH0_DOMAIN` | Auth0 domain |
| `PUBLIC_AUTH0_CLIENT_ID` | Auth0 SPA client ID |
| `PUBLIC_AUTH0_CALLBACK_URL` | Redirect after login |
| `PUBLIC_AUTH0_AUDIENCE` | API audience |
| `PUBLIC_CURRENCY_CODE` | Default `INR` |
| `PUBLIC_LOCALE` | Default `en-IN` |
| `PUBLIC_LISTING_EXPIRY_DAYS` | Mirror of server value (UI display) |
| `PUBLIC_SEARCH_DEFAULT_LIMIT` | Results per page |
| `PUBLIC_MAX_ACTIVE_ADS` | Per-user active ad cap (default `1`) |
| `PUBLIC_RECAPTCHA_SITE_KEY` | reCAPTCHA (wired, not fully active) |
| `PUBLIC_GOOGLE_ANALYTICS_ID` | GA4 tracking ID (optional) |

---

## 15. Security Design

The implementation explicitly addresses **OWASP Top 10**:

| OWASP | Control |
|-------|---------|
| A01 Broken Access Control | Ownership checks on all mutations; contact info gated behind auth |
| A02 Cryptographic Failures | HTTPS enforced; tokens RS256-signed by Auth0; secrets via Secret Manager |
| A03 Injection | URL path injection pattern detection; Prisma parameterized queries; DOMPurify + bad-words on client |
| A04 Insecure Design | Draft-first ad flow; contact privacy by design; active ad limits |
| A05 Security Misconfiguration | Helmet headers; CORS whitelist; startup env validation |
| A06 Vulnerable Components | Pinned dependency versions; multi-stage Docker (minimal attack surface) |
| A07 Auth Failures | JWKS-RSA key rotation; opaque token rejection; no local passwords |
| A08 Software Integrity | Cloud Build + GCR image signing; Secret Manager |
| A09 Logging | Structured security logs (injection attempts, auth failures) |
| A10 SSRF | `validateUrl()` in `validation.ts` rejects private IPs and loopback addresses |

**Rate limiting:** 100 requests / minute per IP (configurable via `@fastify/rate-limit`)

**File upload security:**
- MIME type whitelist (`image/jpeg`, `image/png`, `image/webp`, `image/gif`)
- Extension whitelist (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`)
- Max file size: 5MB per file
- Max files: 5 per listing

---

## 16. Key Design Decisions

### 1. Draft-First Publishing
Listings are always created as `DRAFT` and require at least one uploaded image before publishing. This prevents incomplete or imageless listings from appearing in search.

### 2. Contact Privacy by Design
Seller email/phone are stored in the database but never returned in public listing responses. Public responses include `hasEmail: boolean` and `hasPhone: boolean` flags only. Contact info is revealed exclusively via `GET /api/listings/:id/contact` which requires authentication.

### 3. Dual-Route Registration
Routes are registered with and without the `/api` prefix to support both `locful.com/api/*` (single domain) and `api.locful.com/*` (subdomain) without a reverse proxy rewrite rule.

### 4. Storage Provider Abstraction
The `StorageProvider` interface + factory pattern (`storage.factory.ts`) means Cloudinary can be replaced with AWS S3 or Cloudflare R2 by setting `STORAGE_PROVIDER` env var and implementing the interface. S3/R2 stubs exist but throw `NotImplemented`.

### 5. Expiry by Query Filter (Not Cron)
Listings expire by being excluded from queries (`createdAt > now - expiryDays`) rather than running a cron job that updates statuses. This simplifies operations at the cost of expired rows remaining in the database indefinitely.

### 6. Per-User Active Ad Limit
`PUBLIC_MAX_ACTIVE_ADS` (default 1) caps how many active listings a user can have simultaneously. Enforced client-side in `checkActiveAdsLimit()` and validated server-side on publish.

### 7. India-First Locale
- Currency: INR
- Phone validation: 10-digit Indian numbers
- Location data: 129k+ Indian cities/villages/hamlets from Geoapify
- Deployment region: `asia-southeast1` (Singapore — closest to India with low latency)
