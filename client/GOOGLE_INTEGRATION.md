# Google Integration Guide

This guide explains how to sync your classified ads data to Google services.

## Available Integrations

### 1. Structured Data (Schema.org) - ✅ Implemented

Structured data markup is automatically added to listing pages. This helps Google understand your content and may enable:
- Rich snippets in search results
- Product information cards
- Better search visibility

**Status**: Already implemented on listing detail pages (`/list/[slug]`)

### 2. Google Shopping Feed

Generate product feeds that can be uploaded to Google Merchant Center.

#### Setup Steps:

1. **Create a Google Merchant Center Account**
   - Go to [Google Merchant Center](https://merchants.google.com/)
   - Sign up with your Google account
   - Complete the verification process

2. **Generate the Feed**

   You can create an API endpoint on your backend to generate the feed:

   ```typescript
   // Example backend endpoint (Node.js/Express)
   import { generateGoogleShoppingFeed } from './lib/google-integration';
   
   app.get('/api/feeds/google-shopping.xml', async (req, res) => {
     // Fetch all active listings
     const listings = await fetchActiveListings();
     
     // Generate XML feed
     const feedXml = generateGoogleShoppingFeed(listings, 'https://locful.com');
     
     res.setHeader('Content-Type', 'application/xml');
     res.send(feedXml);
   });
   ```

3. **Upload to Google Merchant Center**
   - Login to Google Merchant Center
   - Go to **Products** → **Feeds**
   - Click **+** to add a new feed
   - Choose **Scheduled fetch** or **Upload**
   - Enter your feed URL: `https://locful.com/api/feeds/google-shopping.xml`
   - Set up automatic updates (daily recommended)

#### Feed Formats Available:

- **XML (RSS)**: `generateGoogleShoppingFeed()` - Standard Google Shopping format
- **CSV**: `generateGoogleShoppingFeedCSV()` - Alternative format

### 3. Sitemap Generation

Generate XML sitemaps for better search engine indexing.

```typescript
import { generateSitemapEntry } from './lib/google-integration';

// Generate sitemap entries for all listings
const sitemapEntries = listings.map(listing => 
  generateSitemapEntry(listing, 'https://locful.com')
);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.join('\n')}
</urlset>`;
```

### 4. Google Ads Integration (Optional)

For advertising your listings:

1. **Set up Google Ads Account**
   - Go to [Google Ads](https://ads.google.com/)
   - Create an account and link it to Merchant Center

2. **Create Shopping Campaigns**
   - Use your Merchant Center feed
   - Set up campaigns to promote listings

## API Endpoints to Create (Backend)

You'll need to create these endpoints on your backend:

### 1. Google Shopping Feed (XML)
```
GET /api/feeds/google-shopping.xml
Content-Type: application/xml
```

### 2. Google Shopping Feed (CSV)
```
GET /api/feeds/google-shopping.csv
Content-Type: text/csv
```

### 3. Sitemap
```
GET /sitemap.xml
Content-Type: application/xml
```

## Example Backend Implementation

```typescript
// Example: routes/api/feeds/google-shopping/+server.ts (SvelteKit)
import { json } from '@sveltejs/kit';
import { generateGoogleShoppingFeed } from '$lib/google-integration';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch }) => {
  try {
    // Fetch all active listings from your API
    const response = await fetch('/api/listings?status=ACTIVE');
    const data = await response.json();
    
    // Generate feed
    const feedXml = generateGoogleShoppingFeed(data.listings, 'https://locful.com');
    
    return new Response(feedXml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  } catch (error) {
    return new Response('Error generating feed', { status: 500 });
  }
};
```

## Testing

1. **Test Structured Data**: Use [Google Rich Results Test](https://search.google.com/test/rich-results)
2. **Test Feed**: Use [Google Merchant Center Feed Validator](https://support.google.com/merchants/answer/7052112)
3. **Test Sitemap**: Submit to [Google Search Console](https://search.google.com/search-console)

## Next Steps

1. ✅ Structured data is already implemented
2. ⏳ Create backend endpoints for feeds
3. ⏳ Set up Google Merchant Center account
4. ⏳ Configure feed uploads
5. ⏳ Monitor performance in Google Search Console

## Notes

- Only **ACTIVE** listings are included in feeds
- Feeds should be updated regularly (daily recommended)
- Images must be publicly accessible URLs
- All prices should be in INR for Indian market
- Ensure your listings comply with [Google Shopping policies](https://support.google.com/merchants/answer/6149221)

