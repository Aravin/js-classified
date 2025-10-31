# Storage Provider Architecture

## Overview

The application uses a **storage provider abstraction** that makes it easy to switch between different cloud storage providers (Cloudinary, AWS S3, Cloudflare R2) without affecting your code or existing images.

## Current Status

✅ **Implemented:** Cloudinary
⏳ **Planned:** AWS S3, Cloudflare R2

## Architecture

```
┌─────────────────────────────────────┐
│      ImageService                   │
│  (Business Logic Layer)             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   StorageProvider Interface         │
│   (Abstraction Layer)              │
└──────────────┬──────────────────────┘
               │
       ┌───────┼───────┐
       │       │       │
       ▼       ▼       ▼
┌──────────┐ ┌─────┐ ┌──────────┐
│Cloudinary│ │ S3  │ │Cloudflare│
│ Provider │ │     │ │  R2      │
└──────────┘ └─────┘ └──────────┘
```

## How to Switch Providers

### Option 1: Environment Variable (Easiest)

Simply change the `STORAGE_PROVIDER` environment variable:

```bash
# Using Cloudinary (default)
STORAGE_PROVIDER=cloudinary

# Using AWS S3 (when implemented)
STORAGE_PROVIDER=aws-s3

# Using Cloudflare R2 (when implemented)
STORAGE_PROVIDER=cloudflare-r2
```

### Option 2: Code Implementation

The factory pattern automatically selects the provider based on the environment variable:

```typescript
// services/storage.factory.ts
export function createStorageProvider(): StorageProvider {
  const providerType = process.env.STORAGE_PROVIDER || 'cloudinary';
  
  switch (providerType) {
    case 'cloudinary':
      return new CloudinaryProvider();
    case 'aws-s3':
      return new AWSProvider(); // To be implemented
    case 'cloudflare-r2':
      return new CloudflareProvider(); // To be implemented
    default:
      return new CloudinaryProvider();
  }
}
```

## Existing Images (Zero Downtime)

### Backward Compatibility

**All existing images stored in Cloudinary will continue to work!**

The system is designed to handle multiple providers simultaneously:

1. **Old images** (Cloudinary URLs) will be served as-is
2. **New images** will use the selected provider
3. No data migration is required

### How It Works

Each provider implements:
- `canHandleUrl(url)` - Checks if the URL belongs to this provider
- `extractPublicId(url)` - Extracts the ID from the URL

This allows the system to:
- Display old images (Cloudinary URLs)
- Upload new images to the new provider
- Handle both URL formats seamlessly

## Adding a New Provider

### Step 1: Create Provider Class

```typescript
// services/providers/aws-s3.provider.ts
export class AWSProvider implements StorageProvider {
  async upload(buffer: Buffer, options: UploadOptions): Promise<UploadResult> {
    // Implement S3 upload logic
  }
  
  async generateThumbnail(publicId: string, options: ThumbnailOptions): Promise<string> {
    // Implement thumbnail generation (e.g., Lambda@Edge)
  }
  
  async delete(publicId: string): Promise<boolean> {
    // Implement S3 delete logic
  }
  
  canHandleUrl(url: string): boolean {
    // Check if URL is S3 URL
  }
  
  extractPublicId(url: string): string | null {
    // Extract key from S3 URL
  }
}
```

### Step 2: Add to Factory

```typescript
// services/storage.factory.ts
import { AWSProvider } from './providers/aws-s3.provider';

export function createStorageProvider(): StorageProvider {
  switch (providerType) {
    case 'aws-s3':
      return new AWSProvider();
    // ...
  }
}
```

### Step 3: Update Environment Variables

```bash
# Add to .env.example
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
AWS_S3_BUCKET=...
```

## Comparison: Providers

| Feature | Cloudinary | AWS S3 | Cloudflare R2 |
|---------|-----------|--------|---------------|
| Image Optimization | ✅ Built-in | ⚠️ Requires Lambda | ⚠️ Requires Worker |
| Thumbnails | ✅ URL-based | ⚠️ Lambda@Edge | ⚠️ Worker |
| CDN | ✅ Included | ✅ CloudFront | ✅ Built-in |
| Cost | Pay-as-you-go | Pay-as-you-go | Most affordable |
| Setup Complexity | Easy | Medium | Easy |
| Vendor Lock-in | ⚠️ High | ✅ Low (standard S3) | ✅ Low (S3-compatible) |

## Migration Strategy

If you want to migrate from Cloudinary to AWS S3 or Cloudflare R2:

### Phase 1: Dual Provider (Gradual Migration)
1. Set up new provider
2. Configure `STORAGE_PROVIDER` for new uploads
3. Old images continue working from Cloudinary
4. Monitor costs and performance

### Phase 2: Migration Script (Optional)
```typescript
// Script to copy images from Cloudinary to S3
const oldImages = await prisma.image.findMany({
  where: { path: { contains: 'res.cloudinary.com' } }
});

for (const image of oldImages) {
  const publicId = extractPublicId(image.path);
  const buffer = await downloadFromCloudinary(publicId);
  const newUrl = await uploadToS3(buffer);
  await prisma.image.update({
    where: { id: image.id },
    data: { path: newUrl }
  });
}
```

### Phase 3: Decommission Old Provider
After migration is complete and verified:
1. Update DNS/CDN if needed
2. Cancel old provider subscription
3. Remove old credentials from .env

## Benefits of This Architecture

✅ **No Vendor Lock-in** - Easy to switch providers
✅ **Zero Downtime** - Existing images keep working
✅ **Cost Optimization** - Can switch to cheaper providers
✅ **Gradual Migration** - Move at your own pace
✅ **Multiple Providers** - Use different providers for different features
✅ **Testing** - Test with local storage before going live

## Environment Variables

See `.env.example` for all available configuration options.




