import type { ListingType } from './types';
import { config } from './config';

// Extended listing type for Google integration
type ListingWithStatus = ListingType & {
  status?: string;
  category?: ListingType['category'] & {
    name?: string;
  };
}

/**
 * Generate structured data (JSON-LD) for a listing
 * This helps Google understand and display your listings in search results
 */
export function generateListingStructuredData(listing: ListingWithStatus, baseUrl: string = 'https://locful.in'): object {
  const imageUrls = listing.images?.map(img => `${baseUrl}${img.path}`) || [];
  const listingUrl = `${baseUrl}/list/${listing.slug}`;
  const status = (listing as any).status || 'ACTIVE';
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description,
    image: imageUrls.length > 0 ? imageUrls : undefined,
    offers: {
      '@type': 'Offer',
      price: listing.price?.toString() || '0',
      priceCurrency: 'INR',
      availability: status === 'ACTIVE' || status === 'active' 
        ? 'https://schema.org/InStock' 
        : 'https://schema.org/OutOfStock',
      url: listingUrl,
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    category: (listing.category as any)?.name || listing.category?.value,
    brand: {
      '@type': 'Brand',
      name: 'locful.in'
    },
    aggregateRating: undefined, // Add if you have ratings
    sku: listing.id.toString(),
    mpn: listing.id.toString(),
    url: listingUrl
  };
}

/**
 * Generate Google Shopping Feed XML format
 * This can be uploaded to Google Merchant Center
 */
export function generateGoogleShoppingFeed(listings: ListingWithStatus[], baseUrl: string = 'https://locful.in'): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>locful.in Classified Ads</title>
    <link>${baseUrl}</link>
    <description>Classified ads from locful.in</description>`;

  const items = listings
    .filter(listing => {
      const status = (listing as any).status || 'ACTIVE';
      return status === 'ACTIVE' || status === 'active';
    })
    .map(listing => {
      const imageUrl = listing.images?.[0]?.path 
        ? `${baseUrl}${listing.images[0].path}` 
        : '';
      const listingUrl = `${baseUrl}/list/${listing.slug}`;
      const price = listing.price || 0;
      const categoryName = (listing.category as any)?.name || listing.category?.value || 'Other';
      
      return `    <item>
      <g:id>${listing.id}</g:id>
      <g:title><![CDATA[${listing.title}]]></g:title>
      <g:description><![CDATA[${listing.description}]]></g:description>
      <g:link>${listingUrl}</g:link>
      ${imageUrl ? `<g:image_link>${imageUrl}</g:image_link>` : ''}
      <g:price>${price} INR</g:price>
      <g:availability>in stock</g:availability>
      <g:condition>new</g:condition>
      <g:brand>locful.in</g:brand>
      <g:mpn>${listing.id}</g:mpn>
      <g:google_product_category>${categoryName}</g:google_product_category>
      <g:product_type>${categoryName} > Classified</g:product_type>
    </item>`;
    })
    .join('\n');

  const footer = `  </channel>
</rss>`;

  return `${header}\n${items}\n${footer}`;
}

/**
 * Generate Google Shopping Feed in CSV format (alternative format)
 */
export function generateGoogleShoppingFeedCSV(listings: ListingWithStatus[], baseUrl: string = 'https://locful.in'): string {
  const headers = [
    'id',
    'title',
    'description',
    'link',
    'image_link',
    'price',
    'availability',
    'condition',
    'brand',
    'mpn',
    'google_product_category',
    'product_type'
  ].join(',');

  const rows = listings
    .filter(listing => {
      const status = (listing as any).status || 'ACTIVE';
      return status === 'ACTIVE' || status === 'active';
    })
    .map(listing => {
      const imageUrl = listing.images?.[0]?.path 
        ? `${baseUrl}${listing.images[0].path}` 
        : '';
      const listingUrl = `${baseUrl}/list/${listing.slug}`;
      const price = listing.price || 0;
      const categoryName = (listing.category as any)?.name || listing.category?.value || 'Other';
      
      const escapeCSV = (str: string) => {
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        listing.id.toString(),
        escapeCSV(listing.title),
        escapeCSV(listing.description),
        listingUrl,
        imageUrl,
        `${price} INR`,
        'in stock',
        'new',
        'locful.in',
        listing.id.toString(),
        categoryName,
        `${categoryName} > Classified`
      ].join(',');
    });

  return [headers, ...rows].join('\n');
}

/**
 * Generate sitemap entry for listings
 */
export function generateSitemapEntry(listing: ListingWithStatus, baseUrl: string = 'https://locful.in'): string {
  const listingUrl = `${baseUrl}/list/${listing.slug}`;
  const lastmod = listing.updatedAt || listing.createdAt;
  const status = (listing as any).status || 'ACTIVE';
  const priority = status === 'ACTIVE' || status === 'active' ? '0.8' : '0.5';
  
  return `  <url>
    <loc>${listingUrl}</loc>
    <lastmod>${new Date(lastmod).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

