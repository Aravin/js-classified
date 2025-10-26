# JS Classified - Database Package

This package contains the Prisma schema and database migrations for the JS Classified application.

## Environment Variables

### Required Variables

- **`DATABASE_URL`**: PostgreSQL connection string
  - Format: `postgresql://username:password@host:port/database?schema=public`
  - Example for local: `postgresql://postgres:password@localhost:5432/js_classified?schema=public`
  - For production: Add `&sslmode=require` to enable SSL

## Setup

### 1. Install Dependencies

```bash
yarn install
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and update the `DATABASE_URL` with your PostgreSQL credentials.

### 3. Run Migrations

Create and apply database migrations:

```bash
yarn db:migrate
```

This will:
- Create a new migration based on your schema changes
- Apply the migration to your database
- Generate the Prisma Client

### 4. Generate Prisma Client

Generate the Prisma Client (if you only made schema changes without creating a migration):

```bash
yarn db:generate
```

### 5. Seed the Database (Optional)

Populate the database with initial data:

```bash
yarn seed
```

**Note**: The seed script reads data from `../docs/` directory:
- `categories.json` - Contains all category and subcategory data
- `place-city.ndjson`, `place-town.ndjson`, `place-hamlet.ndjson`, `place-village.ndjson` - Location data

Make sure these files exist before running the seed command.

## Available Scripts

### Database Management

- **`yarn db:generate`** - Generate Prisma Client
- **`yarn db:migrate`** - Create and apply a new migration (development)
- **`yarn db:migrate:deploy`** - Apply pending migrations (production/staging)
- **`yarn db:studio`** - Open Prisma Studio (database GUI)
- **`yarn db:reset`** - Reset database (drops, recreates, and seeds)

### Data

- **`yarn seed`** - Seed the database with initial data

## Database Schema

### Models

- **`location`** - Location data (cities, towns, villages)
- **`category`** - Categories and subcategories for listings
- **`user`** - User accounts
- **`listing`** - Classified listings
- **`image`** - Listing images

### Listing Status

- `ACTIVE` - Active listing
- `DRAFT` - Draft listing (not published)
- `ENDED` - Listing has ended
- `SUSPENDED` - Listing suspended
- `DELETED` - Listing deleted

## Working with Migrations

### Creating a Migration

1. Update `schema.prisma` with your changes
2. Run `yarn db:migrate`
3. Prisma will prompt you for a migration name
4. The migration will be created in `migrations/` directory

### Viewing Database

To view and manage your database through a GUI:

```bash
yarn db:studio
```

This opens Prisma Studio in your browser where you can browse tables, view data, and make edits.

### Resetting the Database

⚠️ **Warning**: This will delete all data!

```bash
yarn db:reset
```

## Database Architecture

### Locations
Stores city, town, village, and hamlet data with coordinates and geographic information.
- **Seed data**: Population data from NDJSON files (`../docs/place-*.ndjson`)
- **Fields**: name, location type, district, state, country, pincode, coordinates, etc.

### Categories
Hierarchical category system with parent and subcategories for organizing listings.
- **Seed data**: 13 parent categories with multiple subcategories from `../docs/categories.json`
- **Categories include**: Mobiles & Tablets, Electronics, Real Estate, Vehicles, Fashion, Jobs, etc.

### Users
User accounts linked to Auth0, storing user profile information.
- **No seed data**: Created through user registration

### Listings
Classified ad listings with title, description, price, contact information, and status.
- **Sample seed data**: Commented out in `prisma/seed.ts` - can be enabled to create test listings
- **Real data**: Created through the application interface

### Images
Stores images associated with listings, including thumbnails.
- **Seed data**: Sample placeholder images (when sample listings are enabled)

## Development

### Project Structure

```
db/
├── migrations/          # Database migration files
├── prisma/
│   ├── helpers/        # Helper functions
│   └── seed.ts         # Database seeding script
├── schema.prisma       # Prisma schema definition
└── package.json        # Project dependencies and scripts
```

## Notes

- The `.env` file is gitignored - never commit your actual database credentials
- Use `.env.example` as a template for required environment variables
- Always run migrations in the correct order
- Generate Prisma Client after schema changes to update TypeScript types

