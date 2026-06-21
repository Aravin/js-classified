import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OlxCrawlerSource } from './olx.source';
import { FirecrawlClient } from './firecrawl.client';

vi.mock('./firecrawl.client');

describe('OlxCrawlerSource', () => {
  let client: FirecrawlClient;
  let source: OlxCrawlerSource;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new FirecrawlClient();
    source = new OlxCrawlerSource(client);
  });

  // ---------------------------------------------------------------------------
  // getListingUrls
  // ---------------------------------------------------------------------------

  describe('getListingUrls', () => {
    it('extracts and deduplicates OLX item URLs from markdown', async () => {
      client.scrape = vi.fn().mockResolvedValue({
        data: {
          markdown: `
Check out these cars:
[Swift 2018](https://www.olx.in/item/maruti-suzuki-swift-iid-123)
[Honda City](https://www.olx.in/item/honda-city-2020-iid-456)
[Swift 2018 again](/item/maruti-suzuki-swift-iid-123)
          `
        }
      });

      const urls = await source.getListingUrls('https://www.olx.in/chennai/cars', 10);

      expect(urls).toHaveLength(2);
      expect(urls).toContain('https://www.olx.in/item/maruti-suzuki-swift-iid-123');
      expect(urls).toContain('https://www.olx.in/item/honda-city-2020-iid-456');
    });

    it('respects the limit parameter', async () => {
      client.scrape = vi.fn().mockResolvedValue({
        data: {
          markdown: `
/item/car-a-iid-1
/item/car-b-iid-2
/item/car-c-iid-3
/item/car-d-iid-4
          `
        }
      });

      const urls = await source.getListingUrls('https://www.olx.in/chennai/cars', 2);
      expect(urls).toHaveLength(2);
    });

    it('returns empty array when scrape fails', async () => {
      client.scrape = vi.fn().mockRejectedValue(new Error('network error'));
      const urls = await source.getListingUrls('https://www.olx.in/chennai/cars', 10);
      expect(urls).toEqual([]);
    });

    it('returns empty array when markdown has no OLX item URLs', async () => {
      client.scrape = vi.fn().mockResolvedValue({
        data: { markdown: 'No listings found on this page.' }
      });
      const urls = await source.getListingUrls('https://www.olx.in/chennai/cars', 10);
      expect(urls).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getListingDetails — HTML metadata path (primary)
  // ---------------------------------------------------------------------------

  describe('getListingDetails — HTML metadata path', () => {
    const listingUrl = 'https://www.olx.in/item/maruti-suzuki-swift-iid-123';

    it('extracts listing from structured JSON-LD in HTML', async () => {
      const jsonLd = JSON.stringify({
        title: 'Maruti Suzuki Swift 2018',
        description: 'Single owner, excellent condition.',
        price: 450000,
        images: ['https://img.olx.in/swift1.jpg'],
        url: listingUrl,
        id: '123'
      });

      client.scrape = vi.fn().mockResolvedValue({
        data: {
          html: `<script type="application/ld+json">${jsonLd}</script>`,
          markdown: ''
        }
      });

      const result = await source.getListingDetails(listingUrl, 'Chennai', 'car');

      expect(result.title).toBe('Maruti Suzuki Swift 2018');
      expect(result.description).toBe('Single owner, excellent condition.');
      expect(result.price).toBe(450000);
      expect(result.images).toContain('https://img.olx.in/swift1.jpg');
      expect(result.externalLink).toBe(listingUrl);
      expect(result.locationName).toBe('Chennai');
      expect(result.categorySlug).toBe('car');
    });

    it('extracts listing from Open Graph meta tags when JSON-LD is absent', async () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="iPhone 15 Pro Max" />
            <meta property="og:description" content="Like new, 256GB, all accessories" />
            <meta property="og:image" content="https://img.olx.in/iphone.jpg" />
            <meta property="product:price:amount" content="85000" />
          </head>
          <body></body>
        </html>
      `;
      client.scrape = vi.fn().mockResolvedValue({
        data: { html, markdown: '' }
      });

      const result = await source.getListingDetails(
        'https://www.olx.in/item/iphone-15-pro-max-iid-999',
        'Mumbai',
        'mobile-phones'
      );

      expect(result.title).toBe('iPhone 15 Pro Max');
      expect(result.price).toBe(85000);
      expect(result.images).toContain('https://img.olx.in/iphone.jpg');
    });

    it('strips OLX brand suffix from og:title', async () => {
      const html = `
        <html><head>
          <meta property="og:title" content="Honda City 2022 | OLX India" />
          <meta property="og:description" content="Well maintained car" />
          <meta property="og:image" content="https://img.olx.in/honda.jpg" />
          <meta property="product:price:amount" content="900000" />
        </head></html>
      `;
      client.scrape = vi.fn().mockResolvedValue({
        data: { html, markdown: '' }
      });

      const result = await source.getListingDetails(
        'https://www.olx.in/item/honda-city-2022-iid-500',
        'Delhi',
        'car'
      );

      expect(result.title).toBe('Honda City 2022');
    });

    it('falls through to LLM extraction when HTML metadata is insufficient', async () => {
      // scrape returns empty HTML → metadata extraction returns null
      client.scrape = vi.fn().mockResolvedValue({
        data: { html: '<html></html>', markdown: '' }
      });
      // LLM extraction succeeds
      client.scrapeAndExtract = vi.fn().mockResolvedValue({
        title: 'Samsung S23 Ultra',
        description: 'Mint condition phone',
        price: 70000,
        images: ['https://img.olx.in/samsung.jpg']
      });

      const result = await source.getListingDetails(
        'https://www.olx.in/item/samsung-s23-ultra-iid-789',
        'Hyderabad',
        'mobile-phones'
      );

      expect(result.title).toBe('Samsung S23 Ultra');
      expect(result.price).toBe(70000);
      expect(client.scrapeAndExtract).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // getListingDetails — LLM fallback path
  // ---------------------------------------------------------------------------

  describe('getListingDetails — LLM fallback', () => {
    const listingUrl = 'https://www.olx.in/item/oneplus-nord-ce-iid-500';

    beforeEach(() => {
      // Force HTML path to fail → triggers LLM fallback
      client.scrape = vi.fn().mockRejectedValue(new Error('Firecrawl HTML fetch failed'));
    });

    it('throws when LLM extraction also fails', async () => {
      client.scrapeAndExtract = vi.fn().mockRejectedValue(new Error('LLM error'));
      await expect(source.getListingDetails(listingUrl, 'Chennai', 'mobile-phones')).rejects.toThrow();
    });

    it('throws when LLM returns no valid image URLs', async () => {
      client.scrapeAndExtract = vi.fn().mockResolvedValue({
        title: 'OnePlus Nord CE',
        description: 'Good phone',
        price: 18000,
        images: [] // empty
      });
      await expect(source.getListingDetails(listingUrl, 'Chennai', 'mobile-phones')).rejects.toThrow(
        'No valid listing images found'
      );
    });

    it('throws when LLM returns incomplete data (missing title)', async () => {
      client.scrapeAndExtract = vi.fn().mockResolvedValue({
        title: '',
        description: 'Good phone',
        price: 18000,
        images: ['https://img.olx.in/phone.jpg']
      });
      await expect(source.getListingDetails(listingUrl, 'Chennai', 'mobile-phones')).rejects.toThrow();
    });

    it('filters out placeholder and icon image URLs from LLM results', async () => {
      client.scrape = vi.fn().mockResolvedValue({
        data: { html: '<html></html>', markdown: '' }
      });
      client.scrapeAndExtract = vi.fn().mockResolvedValue({
        title: 'OnePlus Nord CE',
        description: 'Good phone',
        price: 18000,
        images: [
          'https://img.olx.in/phone.jpg',         // valid
          'https://img.olx.in/placeholder.gif',    // filtered: contains "placeholder"
          'https://img.olx.in/logo.png',           // filtered: contains "logo"
          'https://img.olx.in/spinner.gif',        // filtered: contains "spinner"
          '/relative/path/image.jpg',              // filtered: relative URL
        ]
      });

      const result = await source.getListingDetails(
        'https://www.olx.in/item/oneplus-nord-iid-400',
        'Chennai',
        'mobile-phones'
      );
      expect(result.images).toEqual(['https://img.olx.in/phone.jpg']);
    });
  });

  // ---------------------------------------------------------------------------
  // looksLikeRecommendation (regression guard — tested via getListingDetails)
  // ---------------------------------------------------------------------------

  describe('looksLikeRecommendation detection', () => {
    it('rejects LLM extraction when title has no token overlap with listing URL', async () => {
      // "Washing Machine" has zero token overlap with "maruti-suzuki-swift-iid-123" → looks like a recommended listing
      client.scrape = vi.fn().mockResolvedValue({
        data: { html: '<html></html>', markdown: '' }
      });
      client.scrapeAndExtract = vi.fn().mockResolvedValue({
        title: 'LG Washing Machine Double Door',
        description: 'In good working condition',
        price: 15000,
        images: ['https://img.olx.in/washer.jpg']
      });

      await expect(
        source.getListingDetails(
          'https://www.olx.in/item/maruti-suzuki-swift-iid-123',
          'Chennai',
          'car'
        )
      ).rejects.toThrow(/does not appear to belong/i);
    });

    it('accepts extraction when title shares tokens with the listing URL', async () => {
      client.scrape = vi.fn().mockRejectedValue(new Error('html fail'));
      client.scrapeAndExtract = vi.fn().mockResolvedValue({
        title: 'Maruti Suzuki Swift 2018 Petrol',
        description: 'Single owner',
        price: 400000,
        images: ['https://img.olx.in/swift.jpg']
      });

      const result = await source.getListingDetails(
        'https://www.olx.in/item/maruti-suzuki-swift-iid-123',
        'Chennai',
        'car'
      );
      expect(result.title).toBe('Maruti Suzuki Swift 2018 Petrol');
    });
  });
});
