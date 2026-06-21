# External Classified Ads Crawler (Firecrawl Cron Job)

We use **Firecrawl API** to periodically crawl, extract, and watermark classified listings from external sites (currently focusing on `olx.in`) and showcase them on `locful.com`.

---

## ⚙️ Configuration (.env)

Add the following environment variables to your `.env` file to configure the crawling behavior:

| Variable | Description | Default |
|----------|-------------|---------|
| `FIRECRAWL_API_KEY` | Your Firecrawl API key (from [firecrawl.dev](https://www.firecrawl.dev/)) | (Required) |
| `CRON_JOB_SECRET` | A secure, random token shared between the server and cron triggers | (Required) |
| `CRAWLER_ENABLED` | Global switch to turn crawling ON or OFF (`true`/`false`) | `true` |
| `CRAWLER_SUPPORTED_SITES` | Comma-separated list of enabled scrapers | `olx` |
| `SHOW_CRAWLED_ITEMS` | Global switch to filter crawled ads from UI search results (`true`/`false`) | `true` |
| `FIRECRAWL_MONTHLY_LIMIT` | Maximum Firecrawl credits to consume per calendar month (safety cap) | `950` |
| `FIRECRAWL_MAX_ITEMS_PER_RUN` | Maximum new listings to crawl in a single cron execution | `3` |

---

## 💻 Running & Testing Locally

### 1. Run Migrations & Generate Clients
Make sure your database has the new `externalLink` and `crawlerLog` models:
```bash
# In db/ folder
npx prisma migrate dev --name add_crawler_fields

# In server/ folder
npx prisma generate
```

### 2. Start Dev Server
```bash
# In server/ folder
yarn dev
```

### 3. Trigger Crawl Manually
Use `curl` or any API client to make a `POST` request to the local crawler cron endpoint. Note that Fastify expects a non-empty body (e.g. `{}`) when the `Content-Type: application/json` header is sent:

```bash
curl -X POST http://localhost:8080/internal/cron/crawl \
  -H "x-cron-secret: <your_CRON_JOB_SECRET_value>" \
  -H "Content-Type: application/json" \
  -d "{}"
```

**Response Format:**
```json
{
  "status": "success",
  "target": "Chennai - car",
  "creditsUsed": 4,
  "listingsAdded": 3,
  "message": "Completed crawl run. Listings processed/added: 3."
}
```

*Note: If you run it again within 24 hours without the `force` flag, it will automatically skip target crawling to save credits.*

### 4. Bypassing Scheduler Limits (For Development Only)
To force-run the crawler and ignore the 24-hour target limits and budget limits during local development, pass `force=true` in the query string:

```bash
curl -X POST "http://localhost:8080/internal/cron/crawl?force=true"
  -H "x-cron-secret: <your_CRON_JOB_SECRET_value>"
  -H "Content-Type: application/json"
  -d "{}"
```

---

## 🧹 Active Listing Cleanup Cron

We run an active listing cleanup cron job daily to manage the lifecycle of both crawled and user-generated classified listings.

### Triggering Cleanup Manually
Make a `POST` request to the local cleanup endpoint:

```bash
curl -X POST http://localhost:8080/internal/cron/cleanup-listings
  -H "x-cron-secret: <your_CRON_JOB_SECRET_value>"
  -H "Content-Type: application/json"
  -d "{}"
```

**Response Format:**
```json
{
  "status": "success",
  "markedInactive": 5,
  "deletedCount": 2
}
```

### Cleanup Logic
1. **Status Expiry**: Finds all `ACTIVE` listings where the age (`republishedAt` or `createdAt`) is older than `LISTING_INACTIVE_DAYS` (default 30) and marks their status as `ENDED` (inactive).
2. **Purging & Deletion**: Finds all listings where the age is older than `LISTING_DELETE_DAYS` (default 45):
   - Purges all associated image assets from Cloudinary (or other configured storage provider).
   - Deletes the listing record from the database (relying on cascade deletes to clean up views, feedbacks, etc.).

---

## 🌐 Deploying to Production (Google Cloud Run)

To run the crawler and cleanup jobs every 24 hours (or on a custom schedule) in production, you can set up triggers using **Google Cloud Scheduler**:

### 1. Environment Variable Setup
Ensure all variables (`FIRECRAWL_API_KEY`, `CRON_JOB_SECRET`, `LISTING_INACTIVE_DAYS`, `LISTING_DELETE_DAYS`, etc.) are securely stored in **Google Secret Manager** and mapped as environment variables in your Cloud Run service configuration.

### 2. Configure Cloud Scheduler Jobs
The production deploy in `server/cloudbuild.yaml` now upserts the crawl and cleanup jobs automatically, as long as the Cloud Build service account can manage Cloud Scheduler, Cloud Run IAM bindings, and Secret Manager access. The jobs it provisions are:

#### A. Crawling Job
- **Frequency (Schedule)**: `30 19 * * *` (Runs daily at 7:30 PM UTC / 1:00 AM IST next day)
- **Target Type**: `HTTP`
- **URL**: `https://api.locful.com/internal/cron/crawl`
- **HTTP Method**: `POST`
- **Headers**:
  - `Content-Type`: `application/json`
  - `X-Cron-Secret`: `<your_CRON_JOB_SECRET_value>`
- **Auth Header**: OIDC token (Use a service account with `roles/run.invoker` permissions).

#### B. Listing Cleanup Job
- **Frequency (Schedule)**: `30 20 * * *` (Runs daily at 8:30 PM UTC / 2:00 AM IST next day, 1 hour after crawling)
- **Target Type**: `HTTP`
- **URL**: `https://api.locful.com/internal/cron/cleanup-listings`
- **HTTP Method**: `POST`
- **Headers**:
  - `Content-Type`: `application/json`
  - `X-Cron-Secret`: `<your_CRON_JOB_SECRET_value>`
- **Auth Header**: OIDC token (Use a service account with `roles/run.invoker` permissions).

---

## 🧠 Core Crawler Logics

1. **Credit Safeguard**: The service checks all successful runs in the current calendar month. If the sum of credits used is greater than or equal to `FIRECRAWL_MONTHLY_LIMIT`, the crawl is aborted.
2. **Round-Robin Target Selection**: On each run, the crawler queries the `crawlerLog` table and selects the target (e.g. `Chennai - car`, `Delhi - mobile-phones`) that hasn't been crawled for the longest time.
3. **24-Hour limit**: Once the target is selected, if its last successful crawl occurred less than 24 hours ago, the crawler skips target scraping to avoid excessive page accesses and credit spend.
4. **Skip & Update Logic**:
   - The crawler fetches the listing links from the category page.
   - For each listing (up to `FIRECRAWL_MAX_ITEMS_PER_RUN`), it scrapes details using Firecrawl.
   - If the listing already exists in the database (resolved via unique `externalLink`), it compares the title, description, and price:
     - **If changed**: It updates the text details, deletes old images, and downloads, watermarks, and uploads the new images.
     - **If unchanged**: It skips processing to save compute cycles.
   - If it is a new listing, it applies the watermark to all photos, uploads them to Cloudinary, and inserts a new active listing under the `system-crawler` user account.
