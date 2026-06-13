import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './+server';

describe('Sitemap Endpoint', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('should generate a valid sitemap XML containing static routes and categories', async () => {
    // Mock fetch returning empty listings
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    const requestEvent = {
      fetch: mockFetch,
      params: {},
      url: new URL('https://locful.com/sitemap.xml'),
    } as any;

    const response = await GET(requestEvent);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');

    const xmlText = await response.text();
    expect(xmlText).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xmlText).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

    // Check static routes
    expect(xmlText).toContain('<loc>https://locful.com</loc>');
    expect(xmlText).toContain('<loc>https://locful.com/search</loc>');
    expect(xmlText).toContain('<loc>https://locful.com/post-ad</loc>');

    // Check category routes (some categories should be present)
    expect(xmlText).toContain('/category/');
  });

  it('should include dynamic listings fetched from the backend API', async () => {
    const mockListings = [
      { slug: 'awesome-bike-1', updatedAt: '2026-06-12T12:00:00.000Z' },
      { slug: 'luxury-apartment-2', updatedAt: '2026-06-12T13:00:00.000Z' },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockListings,
    } as Response);

    const requestEvent = {
      fetch: mockFetch,
      params: {},
      url: new URL('https://locful.com/sitemap.xml'),
    } as any;

    const response = await GET(requestEvent);
    const xmlText = await response.text();

    // Listings should be present in the sitemap
    expect(xmlText).toContain('<loc>https://locful.com/list/awesome-bike-1</loc>');
    expect(xmlText).toContain('<loc>https://locful.com/list/luxury-apartment-2</loc>');
    expect(xmlText).toContain('<lastmod>2026-06-12</lastmod>');
  });

  it('should fallback gracefully and return static routes if the API fetch fails', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('API Down'));

    const requestEvent = {
      fetch: mockFetch,
      params: {},
      url: new URL('https://locful.com/sitemap.xml'),
    } as any;

    const response = await GET(requestEvent);
    expect(response.status).toBe(200);

    const xmlText = await response.text();
    expect(xmlText).toContain('<loc>https://locful.com</loc>');
    expect(xmlText).not.toContain('/list/');
  });
});
