import type { ListingType } from './types';

type ListingWithStatus = ListingType & {
  status?: 'ACTIVE' | 'DRAFT' | 'active' | 'draft';
  category?: ListingType['category'] & {
    name?: string;
  };
  ratingValue?: number | string;
  averageRating?: number | string;
  reviewCount?: number | string;
  ratingCount?: number | string;
  rating?: {
    value?: number | string;
    ratingValue?: number | string;
    reviewCount?: number | string;
    count?: number | string;
    bestRating?: number | string;
    worstRating?: number | string;
  };
};

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

export function generateListingStructuredData(
  listing: ListingWithStatus,
  baseUrl: string = 'https://locful.com',
): Record<string, unknown> {
  const imageUrls =
    listing.images
      ?.map((img) => getAbsoluteImageUrl(img.path, baseUrl))
      .filter((url): url is string => url !== null) || [];

  const listingUrl = `${baseUrl}/list/${listing.slug}`;
  const status = listing.status?.toUpperCase() === 'ACTIVE' || !listing.status ? 'ACTIVE' : 'DRAFT';

  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description,
    ...(imageUrls.length > 0 && { image: imageUrls.length === 1 ? imageUrls[0] : imageUrls }),
    offers: {
      '@type': 'Offer',
      price: listing.price?.toString() || '0',
      priceCurrency: 'INR',
      availability:
        status === 'ACTIVE' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: listingUrl,
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 0,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: '0',
          currency: 'INR',
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'IN',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 7,
            unitCode: 'DAY',
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 14,
            unitCode: 'DAY',
          },
        },
      },
    },
    category: listing.category?.name || listing.category?.value,
    brand: {
      '@type': 'Brand',
      name: 'locful.com',
    },
    sku: listing.id.toString(),
    mpn: listing.id.toString(),
    url: listingUrl,
    review: [],
  };

  const normalizeNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  // Normalize rating value - treat 0 as null (invalid)
  const normalizeRatingValue = (value: unknown): number | null => {
    const num = normalizeNumber(value);
    return num !== null && num > 0 ? num : null;
  };

  // Normalize review count - treat 0 as null (invalid)
  const normalizeReviewCount = (value: unknown): number | null => {
    const num = normalizeNumber(value);
    return num !== null && num > 0 ? num : null;
  };

  const ratingValue =
    normalizeRatingValue(listing.ratingValue) ??
    normalizeRatingValue(listing.averageRating) ??
    normalizeRatingValue(listing.rating?.value) ??
    normalizeRatingValue(listing.rating?.ratingValue);

  const reviewCount =
    normalizeReviewCount(listing.reviewCount) ??
    normalizeReviewCount(listing.ratingCount) ??
    normalizeReviewCount(listing.rating?.reviewCount) ??
    normalizeReviewCount(listing.rating?.count);

  const bestRating = normalizeNumber(listing.rating?.bestRating);
  const worstRating = normalizeNumber(listing.rating?.worstRating);

  // Ensure bestRating and worstRating are valid (bestRating > worstRating, both positive)
  const validBestRating = bestRating !== null && bestRating > 0 ? bestRating : 5;
  const validWorstRating =
    worstRating !== null && worstRating > 0 && worstRating < validBestRating ? worstRating : 1;

  // Validate ratingValue: must be positive, within range, and not null
  const hasValidRating =
    ratingValue !== null &&
    ratingValue > 0 &&
    ratingValue >= validWorstRating &&
    ratingValue <= validBestRating &&
    Number.isFinite(ratingValue);

  // Validate reviewCount: must be positive integer, not null, and not zero
  const hasValidReviewCount =
    reviewCount !== null &&
    reviewCount > 0 &&
    Number.isFinite(reviewCount) &&
    Math.round(reviewCount) > 0;

  // Only include aggregateRating if both rating and reviewCount are valid
  // This ensures we never include aggregateRating with invalid values
  if (hasValidRating && hasValidReviewCount) {
    structuredData.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: ratingValue.toString(),
      reviewCount: Math.round(reviewCount).toString(),
      bestRating: validBestRating.toString(),
      worstRating: validWorstRating.toString(),
    };
  }

  return structuredData;
}

export function generateGoogleShoppingFeed(
  listings: ListingWithStatus[],
  baseUrl: string = 'https://locful.com',
): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>locful.com Classified Ads</title>
    <link>${baseUrl}</link>
    <description>Classified ads from locful.com</description>`;

  const items = listings
    .filter((listing) => {
      const status = listing.status?.toUpperCase() || 'ACTIVE';
      return status === 'ACTIVE';
    })
    .map((listing) => {
      const imageUrl = listing.images?.[0]?.path ? `${baseUrl}${listing.images[0].path}` : '';
      const listingUrl = `${baseUrl}/list/${listing.slug}`;
      const price = listing.price || 0;
      const categoryName =
        (listing.category as { name?: string } & typeof listing.category)?.name ||
        listing.category?.value ||
        'Other';

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

export function generateGoogleShoppingFeedCSV(
  listings: ListingWithStatus[],
  baseUrl: string = 'https://locful.com',
): string {
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
    'product_type',
  ].join(',');

  const rows = listings
    .filter((listing) => {
      const status = listing.status?.toUpperCase() || 'ACTIVE';
      return status === 'ACTIVE';
    })
    .map((listing) => {
      const imageUrl = listing.images?.[0]?.path ? `${baseUrl}${listing.images[0].path}` : '';
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
        `${categoryName} > Classified`,
      ].join(',');
    });

  return [headers, ...rows].join('\n');
}

export function generateSitemapEntry(
  listing: ListingWithStatus,
  baseUrl: string = 'https://locful.com',
): string {
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
