import type { ListingType } from './types';

type ListingWithStatus = ListingType & {
  status?: 'ACTIVE' | 'DRAFT' | 'active' | 'draft';
  category?: ListingType['category'] & {
    name?: string;
  };
}

function getAbsoluteImageUrl(imagePath: string, baseUrl: string): string | null {
  if (!imagePath || typeof imagePath !== 'string') {
    return null;
  }
  
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  if (imagePath.startsWith('/')) {
    return `${baseUrl}${imagePath}`;
  }
  
  return `${baseUrl}/${imagePath}`;
}

export function generateListingStructuredData(listing: ListingWithStatus, baseUrl: string = 'https://locful.com'): any {
  const imageUrls = listing.images
    ?.map(img => getAbsoluteImageUrl(img.path, baseUrl))
    .filter((url): url is string => url !== null) || [];
  
  const listingUrl = `${baseUrl}/list/${listing.slug}`;
  const status = listing.status?.toUpperCase() === 'ACTIVE' || !listing.status ? 'ACTIVE' : 'DRAFT';
  
  const structuredData: any = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description,
    ...(imageUrls.length > 0 && { image: imageUrls.length === 1 ? imageUrls[0] : imageUrls }),
    offers: {
      '@type': 'Offer',
      price: listing.price?.toString() || '0',
      priceCurrency: 'INR',
      availability: status === 'ACTIVE'
        ? 'https://schema.org/InStock' 
        : 'https://schema.org/OutOfStock',
      url: listingUrl,
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 0,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn'
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: '0',
          currency: 'INR'
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'IN'
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 7,
            unitCode: 'DAY'
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 14,
            unitCode: 'DAY'
          }
        }
      }
    },
    category: listing.category?.name || listing.category?.value,
    brand: {
      '@type': 'Brand',
      name: 'locful.com'
    },
    sku: listing.id.toString(),
    mpn: listing.id.toString(),
    url: listingUrl,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '0',
      reviewCount: '0',
      bestRating: '5',
      worstRating: '1'
    },
    review: []
  };

  return structuredData;
}

export function generateGoogleShoppingFeed(listings: ListingWithStatus[], baseUrl: string = 'https://locful.com'): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>locful.com Classified Ads</title>
    <link>${baseUrl}</link>
    <description>Classified ads from locful.com</description>`;

  const items = listings
    .filter(listing => {
      const status = listing.status?.toUpperCase() || 'ACTIVE';
      return status === 'ACTIVE';
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
      <g:brand>locful.com</g:brand>
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

export function generateGoogleShoppingFeedCSV(listings: ListingWithStatus[], baseUrl: string = 'https://locful.com'): string {
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
      const status = listing.status?.toUpperCase() || 'ACTIVE';
      return status === 'ACTIVE';
    })
    .map(listing => {
      const imageUrl = listing.images?.[0]?.path 
        ? `${baseUrl}${listing.images[0].path}` 
        : '';
      const listingUrl = `${baseUrl}/list/${listing.slug}`;
      const price = listing.price || 0;
      const categoryName = listing.category?.name || listing.category?.value || 'Other';
      
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
        'locful.com',
        listing.id.toString(),
        categoryName,
        `${categoryName} > Classified`
      ].join(',');
    });

  return [headers, ...rows].join('\n');
}

export function generateSitemapEntry(listing: ListingWithStatus, baseUrl: string = 'https://locful.com'): string {
  const listingUrl = `${baseUrl}/list/${listing.slug}`;
  const lastmod = listing.updatedAt || listing.createdAt;
  const status = listing.status?.toUpperCase() || 'ACTIVE';
  const priority = status === 'ACTIVE' ? '0.8' : '0.5';
  
  return `  <url>
    <loc>${listingUrl}</loc>
    <lastmod>${new Date(lastmod).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

