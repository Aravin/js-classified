# JS Classified Server

A Fastify-based backend API for a classified ads platform with **flexible storage provider** support.

## Features

- 🎯 **No Vendor Lock-in** - Easy to switch between storage providers (Cloudinary, AWS S3, Cloudflare R2)
- 📸 **Image Optimization** - Automatic resizing, compression, and thumbnail generation
- 🔄 **Backward Compatible** - Existing images continue working when switching providers
- ⚡ **Type-Safe** - Built with TypeScript
- 🛡️ **Validated** - Environment variables checked on startup
- 📊 **Daily Reports** - Automated daily email reports with statistics (new users, logins, listings)

## Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

### Required Variables

- **DATABASE_URL**: PostgreSQL connection string
  - Format: `postgresql://username:password@host:port/database`
  - Example: `postgresql://postgres:password@localhost:5432/jsclassified`

**Storage Provider Configuration:**

- **STORAGE_PROVIDER** (optional): `cloudinary` (default), `aws-s3`, `cloudflare-r2`
  
**If using Cloudinary (default):**
- **CLOUDINARY_CLOUD_NAME**: Your Cloudinary cloud name
- **CLOUDINARY_API_KEY**: Your Cloudinary API key
- **CLOUDINARY_API_SECRET**: Your Cloudinary API secret
- Get credentials from: https://cloudinary.com/console

### Optional Variables

- **PORT**: Server port (default: `8080`)
- **HOST**: Server host (default: `::`)

**Daily Reports Configuration (Optional):**

See [docs/daily-reports.md](./docs/daily-reports.md) for detailed setup instructions.

**Classified Crawler Config (Optional):**

See [docs/crawler.md](./docs/crawler.md) for external crawl configurations, toggles, and schedule instructions.

**For GCP/Cloud Run:** Use SendGrid (Twilio SendGrid) - direct API, no port restrictions! 🆓 **FREE TIER: 12,000 emails/month**

See [docs/free-email-services.md](./docs/free-email-services.md) for all free email service options.

- **EMAIL_ENABLED**: Enable email service (`true`/`false`)
- **EMAIL_PROVIDER**: Email provider (`smtp` or `sendgrid`, default: `smtp`)

**SendGrid Configuration (Twilio SendGrid - Direct API):**
- **SENDGRID_API_KEY**: SendGrid API key (get from [Twilio SendGrid dashboard](https://sendgrid.com) - free signup, no credit card)
- **EMAIL_FROM**: Sender email address (must be verified in SendGrid)
- **EMAIL_TO**: Recipient email(s) - comma-separated

**SMTP Configuration:**
- **EMAIL_HOST**: SMTP server host (default: `smtp.gmail.com`)
- **EMAIL_PORT**: SMTP port (default: `587`)
- **EMAIL_SECURE**: Use SSL (`true` for port 465, `false` for port 587)
- **EMAIL_USER**: SMTP username
- **EMAIL_PASSWORD**: SMTP password
- **EMAIL_FROM**: Sender email address
- **EMAIL_TO**: Recipient email(s) - comma-separated

**Cron Job Configuration:**
- **CRON_DAILY_REPORT_ENABLED**: Enable daily cron job (`true`/`false`)
- **CRON_DAILY_REPORT_TIME**: Cron schedule (default: `30 14 * * *` - **8:00 PM IST / 2:30 PM UTC daily**)
- **CRON_JOB_SECRET**: Shared secret used by Cloud Scheduler (required when daily reports are enabled)

**When emails are sent:** Daily reports are sent at the time specified by `CRON_DAILY_REPORT_TIME`. If not set, defaults to **8:00 PM IST (2:30 PM UTC) daily**. The report contains statistics from the previous day (yesterday).

### Provisioning Cloud Scheduler (one-time setup)

The crawler (`locful-crawl`) and listing-cleanup (`locful-cleanup-listings`) Scheduler jobs are created and kept up-to-date **automatically on every deploy** by [cloudbuild.yaml](./cloudbuild.yaml).

> **Security note:** The Cloud Run service uses `--allow-unauthenticated`. Cron endpoint security is enforced at the application level via the `X-Cron-Secret` header (checked against the `CRON_JOB_SECRET` secret). No OIDC/service-account binding is required.

1. **Allow Cloud Build to deploy and manage Scheduler jobs** (one-time, before the first push)
   ```bash
   PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')
   CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

   # Required to read secrets during build (DATABASE_URL, CRON_JOB_SECRET, etc.)
   gcloud projects add-iam-policy-binding ${PROJECT_ID} \
     --member="serviceAccount:${CLOUD_BUILD_SA}" \
     --role="roles/secretmanager.secretAccessor"

   # Required to deploy and describe Cloud Run services
   gcloud projects add-iam-policy-binding ${PROJECT_ID} \
     --member="serviceAccount:${CLOUD_BUILD_SA}" \
     --role="roles/run.admin"

   # Required to create/update Cloud Scheduler jobs automatically during deploy
   gcloud projects add-iam-policy-binding ${PROJECT_ID} \
     --member="serviceAccount:${CLOUD_BUILD_SA}" \
     --role="roles/cloudscheduler.admin"
   ```
2. **Store the secret** in Secret Manager as `CRON_JOB_SECRET` (use a strong random string).
3. **Create the daily-statistics Cloud Scheduler job** manually (one-time) for the daily email report:
   - Target URL: `https://<cloud-run-url>/internal/cron/daily-statistics`
   - Method: `POST`
   - Header: `X-Cron-Secret: <CRON_JOB_SECRET value>`
   - Auth: No OIDC needed (service is `--allow-unauthenticated`)
   - Schedule: `30 14 * * *` (UTC) or your preferred time



## Setup

1. Install dependencies:
```bash
yarn install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

3. Setup database:
```bash
npx prisma generate
npx prisma migrate dev
```

4. Run development server:
```bash
yarn dev
```

## API Endpoints

http://localhost:8080/api/listings

Status Codes
| Code | Description | |------|-------------| | 201 | Created (POST success) | | 200 | OK (GET, PATCH, DELETE success) | | 400 | Bad Request (validation errors) | | 404 | Not Found | | 500 | Internal Server Error |

Listing Status
| Status | Description | |--------|-------------| | A | Active | | E | Expired | | S | Sold | | D | Deleted |

POST /listings
{
"title": "iPhone 14 Pro Max",
"description": "Brand new iPhone 14 Pro Max, 256GB, Space Black",
"email": "seller@example.com",
"phone": "+1-234-567-8900",
"categoryId": 1,
"locationId": 1,
"images": [
{
"path": "/images/iphone-1.jpg",
"thumbnailPath": "/images/iphone-1-thumb.jpg",
"order": 0
},
{
"path": "/images/iphone-2.jpg",
"order": 1
}
]
}

GET /listings
GET /listings?categoryId=1&locationId=1&status=A[
{
"id": 1,
"title": "iPhone 14 Pro Max",
"slug": "iphone-14-pro-max-1",
"description": "Brand new iPhone 14 Pro Max, 256GB, Space Black",
"email": "seller@example.com",
"phone": "+1-234-567-8900",
"status": "A",
"categoryId": 1,
"locationId": 1,
"createdAt": "2024-01-17T12:00:00.000Z",
"updatedAt": "2024-01-17T12:00:00.000Z",
"category": {
"id": 1,
"name": "Electronics"
},
"location": {
"id": 1,
"name": "New York"
},
"images": [...]
}
]GET /listings/1{
"id": 1,
"title": "iPhone 14 Pro Max",
"slug": "iphone-14-pro-max-1",
// ... same as create response
}

PATCH /listings/1{
"title": "iPhone 14 Pro Max - PRICE REDUCED",
"description": "Like new iPhone 14 Pro Max, 256GB, Space Black. AppleCare+ included",
"status": "S",
"images": [
{
"path": "/images/iphone-new-1.jpg",
"thumbnailPath": "/images/iphone-new-1-thumb.jpg",
"order": 0
}
]
}
DELETE /listings/1{
"success": true
}

Error

{
"error": "Listing not found"
}
