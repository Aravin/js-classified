# JS Classified Server

A Fastify-based backend API for a classified ads platform with **flexible storage provider** support.

## Features

- 🎯 **No Vendor Lock-in** - Easy to switch between storage providers (Cloudinary, AWS S3, Cloudflare R2)
- 📸 **Image Optimization** - Automatic resizing, compression, and thumbnail generation
- 🔄 **Backward Compatible** - Existing images continue working when switching providers
- ⚡ **Type-Safe** - Built with TypeScript
- 🛡️ **Validated** - Environment variables checked on startup

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
