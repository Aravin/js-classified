# db — Prisma + PostgreSQL

Single source of truth for the database schema, migrations, and seed data. Prisma client is generated here and consumed by `server/`.

---

## Commands

```bash
npx prisma migrate dev           # apply pending migrations + regenerate client
npx prisma migrate deploy        # apply migrations (production — no regeneration)
npx prisma db seed               # seed locations (129k+) + category tree
npx prisma studio                # GUI browser at http://localhost:5555
npx prisma generate              # regenerate Prisma client without migrating
npx prisma migrate status        # show pending/applied migrations
npx prisma db push               # push schema to DB without creating a migration (dev only)
```

---

## Environment Variables

```
DATABASE_URL=postgresql://user:pass@localhost:5432/locful
```

---

## Directory Layout

```
db/
├── schema.prisma          PostgreSQL schema — 5 models
├── prisma/
│   ├── seed.ts            Seeds locations from ndjson files + categories from JSON
│   └── helpers/           Seed helper utilities
└── migrations/            7 snapshots (Nov 2024)
    ├── 20241113_init_location_table/
    ├── 20241115_init_category_table/
    ├── 20241116_init_listing_table/
    ├── 20241116_add_slug_to_listing/
    ├── 20241116_add_price_field/
    ├── 20241117_add_draft_status_in_listing_table/
    └── 20241119_add_user_table/
```

---

## Schema Overview (`schema.prisma`)

### `location`
```prisma
model location {
  id           Int       @id @default(autoincrement())
  name         String?          // city/town/village name
  dist         String?          // district
  state        String?
  state_code   String?          // ISO 3166-2 code (e.g. "IN-TN")
  country      String?
  country_code String?
  pincode      String?
  loc_type     String?          // 'city' | 'town' | 'hamlet' | 'village'
  coords       String?          // "lat,lng"
  bbox         String?          // bounding box
  listings     listing[]
}
```
129,181 records. Seeded from Geoapify ndjson files in `docs/`.

### `category`
```prisma
model category {
  id                 Int        @id
  name               String
  slug               String     @unique
  parent_category_id Int?
  parent_category    category?  @relation(...)
  subcategories      category[]
  listings           listing[]
  @@index([parent_category_id])
}
```
Self-referential tree (parent → subcategories). IDs are manually assigned in `docs/categories.json`.

### `ListingStatus` enum
```prisma
enum ListingStatus {
  ACTIVE
  DRAFT
  ENDED
  SUSPENDED
  DELETED
}
```
Transition rules:
- `DRAFT → ACTIVE` via publish (requires ≥1 image)
- `ACTIVE ↔ DRAFT` via status toggle (pause/resume)
- `* → DELETED` via delete
- `* → SUSPENDED` admin only (not implemented in API yet)
- `ENDED` — reserved for future expiry cron (currently expiry is query-time filter)

### `user`
```prisma
model user {
  id        Int       @id @default(autoincrement())
  userId    String    @unique   // Auth0 sub, e.g. "auth0|abc123"
  username  String?   @unique
  email     String?   @unique
  phone     String?   @unique
  fullName  String?
  avatar    String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  lastLogin DateTime?
  listings  listing[]
  @@index([userId])
  @@index([username])
}
```

### `listing`
```prisma
model listing {
  id          Int           @id @default(autoincrement())
  title       String        @db.VarChar(255)
  slug        String        @unique @db.VarChar(255)  // "{title-slugified}-{id}"
  description String        @db.Text
  email       String?       @db.VarChar(255)  // NEVER returned in public responses
  phone       String?       @db.VarChar(20)   // NEVER returned in public responses
  price       Decimal       @db.Decimal(10, 2) @default(0)
  status      ListingStatus @default(DRAFT)
  categoryId  Int
  locationId  Int
  userId      Int
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  images      image[]
  @@index([categoryId])
  @@index([locationId])
  @@index([userId])
  @@index([status])
  @@index([price])
}
```

### `image`
```prisma
model image {
  id            Int      @id @default(autoincrement())
  path          String            // Cloudinary full-res URL
  thumbnailPath String?           // Cloudinary 300×300 webp URL
  order         Int     @default(0)  // 0 = cover/main image
  listingId     Int
  listing       listing  @relation(..., onDelete: Cascade)
  createdAt     DateTime @default(now())
  @@index([listingId])
  @@index([order])
}
```

---

## Seed Data

```bash
npx prisma db seed
```

The seed script (`prisma/seed.ts`) runs two operations:

1. **Locations** — streams `docs/place-city.ndjson`, `place-town.ndjson`, `place-hamlet.ndjson`, `place-village.ndjson` and bulk-inserts with `createMany` (skipDuplicates). ~129k records.

2. **Categories** — reads `docs/categories.json` and recursively inserts parent categories then subcategories with fixed IDs.

**Data sources:**
- Locations: [Geoapify](https://www.geoapify.com/downloads/) + [data.gov.in pincode directory](https://www.data.gov.in/catalog/all-india-pincode-directory)

---

## Adding a New Migration

```bash
# 1. Edit schema.prisma with your changes
# 2. Create migration + regenerate client
npx prisma migrate dev --name describe_your_change

# 3. The generated migration SQL is in migrations/<timestamp>_describe_your_change/migration.sql
# 4. Commit both schema.prisma and the new migration directory
```

**Never** edit existing migration files — create a new migration instead.

---

## Prisma Client Usage (in `server/`)

The Prisma client is generated in `db/` and consumed by `server/`. After schema changes, regenerate:

```bash
# From db/
npx prisma generate

# Or from server/ (via prepare script)
npx prisma generate
```

The `server/Dockerfile` runs `prisma generate` during the build stage so the correct client is bundled.

---

## Important Constraints

- `listing.email` and `listing.phone` — **never expose in public API responses**. Always call `maskSensitiveData()` in `server/api/routes/listing.routes.ts`.
- `image.order = 0` — always the cover image. The `order` value is set by the client's drag-and-drop reorder operation.
- `listing.slug` — format is `{slugified-title}-{id}`. Must remain unique. Generated server-side on creation.
- `location` records — **read-only in production**. Only populated by seed. Never create locations via API.
- `category` records — **read-only in production**. Only populated by seed. Never create categories via API.
