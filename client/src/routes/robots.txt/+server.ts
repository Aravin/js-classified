import type { RequestHandler } from './$types';

const BASE_URL = 'https://locful.com';

/**
 * Generate robots.txt for search engine crawlers
 * This tells search engines which pages they can crawl and where to find the sitemap
 */
export const GET: RequestHandler = async () => {
	const robotsTxt = `User-agent: *
Allow: /

# Disallow private/user-specific pages
Disallow: /my-ads
Disallow: /my-ads/
Disallow: /settings
Disallow: /settings/
Disallow: /post-ad/preview
Disallow: /post-ad/preview/

# Sitemap location
Sitemap: ${BASE_URL}/sitemap.xml
`;

	return new Response(robotsTxt, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
		}
	});
};

