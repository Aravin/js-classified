import { categories } from '$lib/categories/categories';
import type { RequestHandler } from './$types';

const BASE_URL = 'https://locful.com';

// Static routes with their priorities and change frequencies
const staticRoutes = [
	{ path: '', priority: '1.0', changefreq: 'daily' }, // Home page
	{ path: '/search', priority: '0.9', changefreq: 'daily' },
	{ path: '/post-ad', priority: '0.8', changefreq: 'monthly' }
];

/**
 * Generate sitemap.xml for Google Search Console
 * This helps Google discover and index all pages on the site
 */
export const GET: RequestHandler = async () => {
	const currentDate = new Date().toISOString().split('T')[0];

	// Start building the sitemap XML
	let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

	// Add static routes
	for (const route of staticRoutes) {
		sitemap += `  <url>
    <loc>${BASE_URL}${route.path}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>
`;
	}

	// Add category pages
	for (const category of categories) {
		sitemap += `  <url>
    <loc>${BASE_URL}/category/${category.slug}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
	}

	// Close the urlset
	sitemap += `</urlset>`;

	return new Response(sitemap, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
		}
	});
};

