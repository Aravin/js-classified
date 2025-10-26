# JS Classified - Client

SvelteKit client application for the JS Classified marketplace.

## Prerequisites

- Node.js 18+ and Yarn
- Backend API running
- Auth0 account and application configured

## Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd client
```

2. **Install dependencies**

```bash
yarn install
```

3. **Configure environment variables**

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` and fill in your Auth0 credentials. See the [Environment Variables](#environment-variables) section below for details.

4. **Run the development server**

```bash
yarn dev
```

5. **Open your browser**

Navigate to `http://localhost:5173` (or the port shown in your terminal)

## Available Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn preview` - Preview production build
- `yarn lint` - Run linter
- `yarn lint:fix` - Run linter with auto-fix
- `yarn format` - Format code with Prettier
- `yarn check` - Type check with Svelte Check

## Environment Variables

All environment variables are loaded from `src/lib/config.ts` and must be prefixed with `PUBLIC_` to be accessible in the browser (SvelteKit requirement).

### Required Variables

**Authentication** (Required for the app to work):

```bash
PUBLIC_AUTH0_DOMAIN=your-auth0-domain.auth0.com  # Your Auth0 domain (e.g., your-tenant.auth0.com)
PUBLIC_AUTH0_CLIENT_ID=your-auth0-client-id       # Your Auth0 application client ID
PUBLIC_AUTH0_CALLBACK_URL=http://localhost:5173  # The URL where Auth0 should redirect after authentication
```

### Optional Variables (with defaults)

```bash
PUBLIC_API_URL=http://localhost:8080/api          # Base URL for the backend API (default: http://localhost:8080/api)
PUBLIC_CURRENCY_CODE=INR                          # Currency code for price formatting (default: INR)
PUBLIC_LOCALE=en-IN                               # Locale string for number formatting (default: en-IN)
PUBLIC_LISTING_EXPIRY_DAYS=30                     # Number of days before a listing expires (default: 30)
PUBLIC_SEARCH_DEFAULT_LIMIT=5                     # Default number of results per page (default: 5)
```

### Notes

- All environment variables must be prefixed with `PUBLIC_` to be accessible in browser code
- Copy `.env.example` to `.env` and fill in your values
- The `.env` file is gitignored and should not be committed to version control
- For production, set these variables in your hosting platform's environment configuration
