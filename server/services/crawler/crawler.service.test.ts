import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CrawlerService } from './crawler.service';
import { FirecrawlClient } from './firecrawl.client';

// Mock dependencies
vi.mock('./firecrawl.client');

vi.mock('../image.service', () => {
  return {
    ImageService: {
      prepareUploads: vi.fn().mockResolvedValue([
        {
          path: 'https://res.cloudinary.com/demo/image/upload/v1/classified/test.jpg',
          thumbnailPath: 'https://res.cloudinary.com/demo/image/upload/c_fill,h_300,q_80,w_300/v1/classified/test.webp',
          order: 0,
          publicId: 'classified/test'
        }
      ]),
      createImageRecords: vi.fn().mockResolvedValue([]),
      deleteStoredImagesByUrls: vi.fn().mockResolvedValue(undefined),
      uploadImages: vi.fn().mockResolvedValue([])
    }
  };
});

vi.mock('../../utils/watermark', () => {
  return {
    applyWatermark: vi.fn().mockImplementation(async (buf) => buf)
  };
});

// Mock global fetch for downloading images
const mockFetch = vi.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(10000))
  } as any)
);
global.fetch = mockFetch;

describe('CrawlerService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock FirecrawlClient getCreditUsage
    FirecrawlClient.prototype.getCreditUsage = vi.fn().mockResolvedValue({
      remainingCredits: 500,
      billingPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    });

    // Mock prisma client
    mockPrisma = {
      crawlerLog: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { creditsUsed: 10 } }),
        groupBy: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({})
      },
      location: {
        findFirst: vi.fn().mockResolvedValue({ id: 1, name: 'Chennai' })
      },
      category: {
        findUnique: vi.fn().mockResolvedValue({ id: 2, slug: 'car' })
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 9, userId: 'system-crawler' })
      },
      $transaction: vi.fn().mockImplementation(async (input: any) => {
        if (typeof input === 'function') {
          return await input(mockPrisma);
        }
        return await Promise.all(input);
      }),
      listing: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 101, title: 'Temp' }),
        update: vi.fn().mockResolvedValue({})
      },
      image: {
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({})
      }
    };
  });

  it('should run crawler job successfully when credits are within limits', async () => {
    // Mock FirecrawlClient scrape response (category list)
    const mockScrape = vi.fn().mockResolvedValue({
      success: true,
      data: { markdown: 'Listing: [Car](https://www.olx.in/item/maruti-suzuki-swift-iid-12345)' }
    });
    const mockScrapeAndExtract = vi.fn().mockResolvedValue({
      title: 'Maruti Suzuki Swift 2018',
      description: 'Excellent condition, single owner',
      price: 450000,
      images: ['https://example.com/car1.jpg']
    });

    FirecrawlClient.prototype.scrape = mockScrape;
    FirecrawlClient.prototype.scrapeAndExtract = mockScrapeAndExtract;

    const crawlerService = new CrawlerService(mockPrisma);
    const result = await crawlerService.runCrawlJob();

    expect(result.status).toBe('success');
    expect(result.listingsAdded).toBe(1);
    expect(mockPrisma.listing.create).toHaveBeenCalled();
  });

  it('should skip crawling when monthly credit limit is exceeded', async () => {
    // Set creditsUsed to 1000 (exceeds default 950 limit)
    mockPrisma.crawlerLog.aggregate.mockResolvedValue({ _sum: { creditsUsed: 1000 } });

    const crawlerService = new CrawlerService(mockPrisma);
    const result = await crawlerService.runCrawlJob();

    expect(result.status).toBe('skipped');
    expect(result.listingsAdded).toBe(0);
    expect(result.message).toContain('monthly credit limit reached');
  });

  it('should skip duplicate URLs when their content is not updated', async () => {
    const mockScrape = vi.fn().mockResolvedValue({
      success: true,
      data: { markdown: 'Listing: [Car](https://www.olx.in/item/maruti-suzuki-swift-iid-12345)' }
    });
    const mockScrapeAndExtract = vi.fn().mockResolvedValue({
      title: 'Maruti Suzuki Swift 2018',
      description: 'Excellent condition, single owner',
      price: 450000,
      images: ['https://example.com/car1.jpg']
    });
    FirecrawlClient.prototype.scrape = mockScrape;
    FirecrawlClient.prototype.scrapeAndExtract = mockScrapeAndExtract;

    // Mock existing listing returned by db check (which matches crawled details)
    mockPrisma.listing.findUnique.mockResolvedValue({
      id: 101,
      status: 'ACTIVE',
      title: 'Maruti Suzuki Swift 2018',
      description: 'Excellent condition, single owner',
      price: 450000,
      images: [{ id: 10, path: 'https://example.com/car1.jpg' }]
    });

    const crawlerService = new CrawlerService(mockPrisma);
    const result = await crawlerService.runCrawlJob();

    expect(result.status).toBe('success');
    expect(result.listingsAdded).toBe(0); // No listings added because it was a duplicate and unchanged
    expect(result.message).toContain('Listings processed/added: 0');
  });

  it('should update listing if URL exists but content is changed', async () => {
    const mockScrape = vi.fn().mockResolvedValue({
      success: true,
      data: { markdown: 'Listing: [Car](https://www.olx.in/item/maruti-suzuki-swift-iid-12345)' }
    });
    const mockScrapeAndExtract = vi.fn().mockResolvedValue({
      title: 'Maruti Suzuki Swift 2018 (Updated)',
      description: 'Excellent condition, single owner',
      price: 430000, // Price updated
      images: ['https://example.com/car_new.jpg']
    });

    FirecrawlClient.prototype.scrape = mockScrape;
    FirecrawlClient.prototype.scrapeAndExtract = mockScrapeAndExtract;

    // Mock existing listing with different details
    mockPrisma.listing.findUnique.mockResolvedValue({
      id: 101,
      status: 'ACTIVE',
      title: 'Maruti Suzuki Swift 2018',
      description: 'Excellent condition, single owner',
      price: 450000,
      images: [{ id: 10, path: 'https://example.com/car1.jpg' }]
    });

    const crawlerService = new CrawlerService(mockPrisma);
    const result = await crawlerService.runCrawlJob();

    expect(result.status).toBe('success');
    expect(result.listingsAdded).toBe(1); // 1 listing updated
    expect(mockPrisma.listing.update).toHaveBeenCalled();
  });

  it('counts each detail scrape only once when processing fails after fetching listing details', async () => {
    const mockScrape = vi.fn().mockResolvedValue({
      success: true,
      data: { markdown: 'Listing: [Car](https://www.olx.in/item/maruti-suzuki-swift-iid-12345)' }
    });
    const mockScrapeAndExtract = vi.fn().mockResolvedValue({
      title: 'Maruti Suzuki Swift 2018',
      description: 'Excellent condition, single owner',
      price: 450000,
      images: ['https://example.com/car1.jpg']
    });

    FirecrawlClient.prototype.scrape = mockScrape;
    FirecrawlClient.prototype.scrapeAndExtract = mockScrapeAndExtract;
    mockPrisma.$transaction = vi.fn().mockRejectedValue(new Error('database write failed'));

    const crawlerService = new CrawlerService(mockPrisma);
    const result = await crawlerService.runCrawlJob();

    expect(result.status).toBe('failed');
    expect(result.listingsAdded).toBe(0);
    expect(result.creditsUsed).toBe(2);
    expect(result.message).toContain('no successful listing processing');
    expect(mockPrisma.crawlerLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'FAILED',
        creditsUsed: 2,
      }),
    }));
  });

  it('marks run as FAILED (not SUCCESS) when new listing has no valid images', async () => {
    // Regression test for P1 bug: a new listing that yields zero valid images was
    // previously counted as successfulItems += 1, letting the run log SUCCESS and
    // blocking the target for 24 hours even though no real work was done.
    const mockScrape = vi.fn().mockResolvedValue({
      success: true,
      data: { markdown: 'Listing: [Car](https://www.olx.in/item/maruti-suzuki-swift-iid-12345)' }
    });
    const mockScrapeAndExtract = vi.fn().mockResolvedValue({
      title: 'No-Image Car',
      description: 'No images returned by scraper',
      price: 100000,
      images: [] // scraper returned no image URLs
    });

    FirecrawlClient.prototype.scrape = mockScrape;
    FirecrawlClient.prototype.scrapeAndExtract = mockScrapeAndExtract;

    // Simulate fetch returning a tiny placeholder buffer (< 8000 bytes → rejected)
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)) // too small
      } as any)
    );

    const crawlerService = new CrawlerService(mockPrisma);
    const result = await crawlerService.runCrawlJob();

    // With no valid images, no listing should be created and the run should be FAILED
    expect(result.status).toBe('failed');
    expect(result.listingsAdded).toBe(0);
    expect(mockPrisma.listing.create).not.toHaveBeenCalled();
    expect(mockPrisma.crawlerLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED' })
    }));
  });

  it('returns SUCCESS when at least one item succeeds even if others fail', async () => {
    // Two listings in the category page; first succeeds, second fails during DB write.
    // Reset fetch to return a large enough buffer (> 8000 bytes) for image download to succeed.
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10000))
      } as any)
    );

    const mockScrape = vi.fn().mockResolvedValue({
      success: true,
      data: {
        markdown: `
          /item/good-car-iid-100
          /item/bad-car-iid-200
        `
      }
    });

    // scrapeAndExtract called once per listing
    const mockScrapeAndExtract = vi.fn()
      .mockResolvedValueOnce({
        title: 'Good Car',
        description: 'Excellent',
        price: 300000,
        images: ['https://img.olx.in/good.jpg']
      })
      .mockResolvedValueOnce({
        title: 'Bad Car',
        description: 'Will fail on write',
        price: 200000,
        images: ['https://img.olx.in/bad.jpg']
      });

    FirecrawlClient.prototype.scrape = mockScrape;
    FirecrawlClient.prototype.scrapeAndExtract = mockScrapeAndExtract;

    // First transaction succeeds, second throws
    mockPrisma.$transaction = vi.fn()
      .mockImplementationOnce(async (fn: any) => fn(mockPrisma))
      .mockRejectedValueOnce(new Error('DB write failed for bad car'));

    const crawlerService = new CrawlerService(mockPrisma);
    const result = await crawlerService.runCrawlJob();

    // At least 1 succeeded → run should be SUCCESS
    expect(result.status).toBe('success');
    expect(result.listingsAdded).toBe(1);
    expect(mockPrisma.crawlerLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'SUCCESS' })
    }));
  });

  it('repairs an existing listing that has no images (requiresRepair=true)', async () => {
    // Reset fetch to return a large buffer so image download succeeds.
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10000))
      } as any)
    );

    const mockScrape = vi.fn().mockResolvedValue({
      success: true,
      data: { markdown: 'Listing: [Car](https://www.olx.in/item/maruti-suzuki-swift-iid-12345)' }
    });
    const mockScrapeAndExtract = vi.fn().mockResolvedValue({
      title: 'Maruti Suzuki Swift 2018',
      description: 'Excellent condition, single owner',
      price: 450000,
      images: ['https://example.com/car1.jpg']
    });

    FirecrawlClient.prototype.scrape = mockScrape;
    FirecrawlClient.prototype.scrapeAndExtract = mockScrapeAndExtract;

    // Existing listing is ACTIVE but has 0 images → triggers repair branch
    mockPrisma.listing.findUnique.mockResolvedValue({
      id: 101,
      status: 'ACTIVE',
      title: 'Maruti Suzuki Swift 2018',
      description: 'Excellent condition, single owner',
      price: 450000,
      images: [] // no images → requiresRepair = true
    });

    const crawlerService = new CrawlerService(mockPrisma);
    const result = await crawlerService.runCrawlJob();

    expect(result.status).toBe('success');
    expect(result.listingsAdded).toBe(1); // repair counts as an update
    expect(mockPrisma.listing.update).toHaveBeenCalled();
  });

  it('skips run when daily credit budget is exhausted', async () => {
    // Simulate budget: 500 credits / 15 days = ~33/day; last 24h used 50 → available < 2 → skip
    FirecrawlClient.prototype.getCreditUsage = vi.fn().mockResolvedValue({
      remainingCredits: 500,
      billingPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    });
    // Simulate 50 credits used in last 24h (daily budget exhausted: 33 < 50)
    mockPrisma.crawlerLog.aggregate.mockResolvedValue({ _sum: { creditsUsed: 1000 } });

    const crawlerService = new CrawlerService(mockPrisma);
    const result = await crawlerService.runCrawlJob();

    expect(result.status).toBe('skipped');
    expect(result.listingsAdded).toBe(0);
  });
});
