# client — SvelteKit Frontend

SvelteKit SPA for locful.com. Talks to the Fastify API (`server/`) for all data. No SSR data loading — all API calls happen in-browser.

---

## Commands

```bash
yarn dev          # vite dev server → http://localhost:5173
yarn build        # production build
yarn preview      # preview production build
yarn check        # svelte-check + tsc type check
yarn lint         # prettier --check + eslint
yarn lint:fix     # eslint --fix
yarn format       # prettier --write
```

---

## Environment Variables

Copy `.env.example` to `.env`:

```
PUBLIC_API_URL=http://localhost:8080
PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
PUBLIC_AUTH0_CLIENT_ID=...
PUBLIC_AUTH0_CALLBACK_URL=http://localhost:5173
PUBLIC_AUTH0_AUDIENCE=https://api.locful.com
PUBLIC_CURRENCY_CODE=INR
PUBLIC_LOCALE=en-IN
PUBLIC_LISTING_EXPIRY_DAYS=30
PUBLIC_SEARCH_DEFAULT_LIMIT=20
PUBLIC_MAX_ACTIVE_ADS=1
```

All vars accessed via `src/lib/config.ts` — never read `import.meta.env` directly in components.

---

## Directory Layout

```
src/
├── app.html                     HTML shell
├── app.css                      Tailwind base styles
├── app.d.ts                     Ambient type declarations
├── lib/
│   ├── auth/
│   │   └── auth0.ts             Auth0 SPA SDK + 4 Svelte stores
│   ├── components/              Reusable Svelte components
│   │   ├── Header.svelte
│   │   ├── Footer.svelte
│   │   ├── ListingCard.svelte
│   │   ├── ImageUpload.svelte   Drag-and-drop multi-image uploader
│   │   ├── CategoryGrid.svelte
│   │   └── ...
│   ├── stores/
│   │   └── filters.ts           selectedLocation, selectedCategory, searchQuery
│   ├── categories/              Static category tree (mirrors DB)
│   ├── config.ts                PUBLIC_ env vars typed object
│   ├── form-validation.ts       Zod-like validation + DOMPurify + bad-words
│   ├── google-integration.ts    Schema.org JSON-LD, Google Shopping feed
│   ├── locations.ts             Location lookup helpers
│   ├── badwords.ts              Profanity filter
│   ├── types.ts                 Shared TS types
│   └── utils.ts                 slug, price format, expiry helpers
└── routes/
    ├── +layout.svelte           Global shell (header, search bar, footer)
    ├── +page.svelte             Homepage — hero, category grid, recent listings
    ├── +error.svelte            Error page
    ├── category/[slug]/         Category browse (filtered listing grid)
    ├── list/[slug]/             Listing detail + contact reveal button
    ├── search/                  Full-text + filter search results
    ├── post-ad/                 Multi-step ad creation form
    │   └── preview/             Preview step before publish
    ├── my-ads/                  User's listing dashboard
    │   └── edit/[id]/           Edit an existing listing
    ├── settings/                User profile management
    ├── sitemap.xml/             Dynamically generated XML sitemap
    └── robots.txt/              Dynamically generated robots.txt
```

---

## Authentication

`src/lib/auth/auth0.ts` wraps the Auth0 SPA SDK and exports 4 Svelte stores:

```typescript
isAuthenticated  // boolean
user             // Auth0 user profile object
auth0Client      // Auth0Client instance
authState        // 'loading' | 'authenticated' | 'unauthenticated'
```

**Login flow:**
1. `loginWithPopup()` — Auth0 popup window
2. ID token stored in `localStorage` (`cacheLocation: 'localstorage'`)
3. On login, `POST /api/users` is called to upsert the user record in the DB

**Making authenticated API calls:**
```typescript
import { getAuthHeaders } from '$lib/auth/auth0';

const res = await fetch(`${PUBLIC_API_URL}/api/listings`, {
  headers: await getAuthHeaders(),  // { Authorization: 'Bearer <token>' }
});
```

**Guarding a page:**
```svelte
<script>
  import { isAuthenticated, authState } from '$lib/auth/auth0';
</script>

{#if $authState === 'loading'}
  <span>Loading...</span>
{:else if !$isAuthenticated}
  <p>Please log in.</p>
{:else}
  <!-- protected content -->
{/if}
```

---

## Form Validation

`src/lib/form-validation.ts` provides:

- `sanitizeInput(value)` — strips HTML via DOMPurify
- `containsProfanity(value)` — checks bad-words list
- Validation helpers for title (max 255), description (max 5000), price (≥0), phone (10-digit Indian)

**Always sanitize before submitting to the API:**
```typescript
import { sanitizeInput } from '$lib/form-validation';

const cleanTitle = sanitizeInput(formData.title);
```

---

## Active Ad Limit

`PUBLIC_MAX_ACTIVE_ADS` (default `1`) caps active listings per user. Check before activating:
```typescript
import { checkActiveAdsLimit } from '$lib/utils';
// Returns true if user is at or above the active ads cap
```
The server also enforces this on `PATCH /api/listings/:id/publish`.

---

## Adding a New Page

1. Create `src/routes/<path>/+page.svelte`
2. Use `PUBLIC_API_URL` from `$lib/config` for all API calls
3. Import auth stores from `$lib/auth/auth0` if login is required
4. Use `getAuthHeaders()` for protected API calls
5. Register links in `Header.svelte` if needed

---

## Styling Conventions

- Utility-first with **TailwindCSS**
- Component library: **DaisyUI** (btn, card, modal, badge, etc.)
- Typography plugin: `@tailwindcss/typography` for prose content
- Icons: `@iconify/svelte` — `<Icon icon="..." />`

---

## SEO

`google-integration.ts` handles:
- **Schema.org JSON-LD** (Product + Offer) injected on listing detail pages
- **Google Shopping XML/CSV feeds** (available as route endpoints)
- Dynamic `sitemap.xml` and `robots.txt` via SvelteKit server routes

---

## Key Types (`src/lib/types.ts`)

```typescript
Listing   { id, title, slug, description, price, status, hasEmail, hasPhone,
            category, location, user, images, createdAt }
User      { id, userId, username, email, phone, fullName, avatar }
Category  { id, name, slug, subcategories? }
Location  { id, name, dist, state, state_code }
Image     { id, path, thumbnailPath, order }
```

`email` and `phone` are absent on public `Listing` — only `hasEmail`/`hasPhone` booleans exist. Use `GET /api/listings/:id/contact` (auth required) to fetch actual contact details.
