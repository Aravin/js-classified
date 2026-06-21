import { PrismaClient, ListingStatus } from '@prisma/client';
import { config } from '../../config/config';
import { ImageService } from '../image.service';
import { CrawledListing, CrawlerSource } from './crawler.interface';
import { FirecrawlClient } from './firecrawl.client';
import { OlxCrawlerSource } from './olx.source';

// Define the crawl targets for round-robin scheduling
// Each target maps a location name and a category slug to their OLX-specific URL components
export interface CrawlTarget {
  locationName: string;   // Must match locful location.name (case-insensitive)
  categorySlug: string;   // Must match locful category.slug (e.g., 'car', 'mobile-phones')
  locationUrlSlug: string; // OLX location path segment (e.g. 'chennai_g4059162')
  categoryUrlSlug: string; // OLX category path segment (e.g. 'cars_c84')
}

export const CRAWL_TARGETS: CrawlTarget[] = [
  { locationName: 'Chennai', categorySlug: 'car', locationUrlSlug: 'chennai_g4059162', categoryUrlSlug: 'cars_c84' },
  { locationName: 'Chennai', categorySlug: 'mobile-phones', locationUrlSlug: 'chennai_g4059162', categoryUrlSlug: 'mobile-phones_c1453' },
  { locationName: 'Hyderabad', categorySlug: 'car', locationUrlSlug: 'hyderabad_g4058526', categoryUrlSlug: 'cars_c84' },
  { locationName: 'Hyderabad', categorySlug: 'mobile-phones', locationUrlSlug: 'hyderabad_g4058526', categoryUrlSlug: 'mobile-phones_c1453' },
  { locationName: 'Bengaluru', categorySlug: 'car', locationUrlSlug: 'bengaluru_g4058384', categoryUrlSlug: 'cars_c84' },
  { locationName: 'Bengaluru', categorySlug: 'mobile-phones', locationUrlSlug: 'bengaluru_g4058384', categoryUrlSlug: 'mobile-phones_c1453' },
  { locationName: 'Delhi', categorySlug: 'car', locationUrlSlug: 'delhi_g2001159', categoryUrlSlug: 'cars_c84' },
  { locationName: 'Delhi', categorySlug: 'mobile-phones', locationUrlSlug: 'delhi_g2001159', categoryUrlSlug: 'mobile-phones_c1453' },
  { locationName: 'Mumbai', categorySlug: 'car', locationUrlSlug: 'mumbai_g4058997', categoryUrlSlug: 'cars_c84' },
  { locationName: 'Mumbai', categorySlug: 'mobile-phones', locationUrlSlug: 'mumbai_g4058997', categoryUrlSlug: 'mobile-phones_c1453' }
];

export class CrawlerService {
  private prisma: PrismaClient;
  private firecrawlClient: FirecrawlClient;
  private olxSource: CrawlerSource;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.firecrawlClient = new FirecrawlClient();
    this.olxSource = new OlxCrawlerSource(this.firecrawlClient);
  }

  private async downloadListingImages(imageUrls: string[]): Promise<{ buffer: Buffer; order: number }[]> {
    const imageBuffers: { buffer: Buffer; order: number }[] = [];
    const maxImages = config.crawler.maxImagesPerListing;
    const imagesToProcess = imageUrls.slice(0, maxImages);

    for (const imgUrl of imagesToProcess) {
      try {
        const imgResponse = await fetch(imgUrl);
        if (!imgResponse.ok) continue;
        const buffer = Buffer.from(await imgResponse.arrayBuffer());

        if (buffer.length < 8000) {
          console.log(`[CrawlerService] Skipping image ${imgUrl} because it is too small (${buffer.length} bytes), likely a placeholder.`);
          continue;
        }

        imageBuffers.push({ buffer, order: imageBuffers.length });
      } catch (err) {
        console.error(`[CrawlerService] Error downloading image ${imgUrl}:`, err);
      }
    }

    return imageBuffers;
  }

  /**
   * Main cron orchestrator method.
   * Runs target selection, budget checks, crawling, watermarking, and logging.
   */
  async runCrawlJob(force: boolean = false): Promise<{
    status: 'success' | 'skipped' | 'failed';
    target?: string;
    creditsUsed: number;
    listingsAdded: number;
    message?: string;
  }> {
    console.log('[CrawlerService] Starting crawler job...');

    // 0. Check global enabled toggle from config
    if (!config.crawler.enabled && !force) {
      const skipMsg = 'Crawler job skipped: crawler is disabled in environment config.';
      console.log(`[CrawlerService] ${skipMsg}`);
      return { status: 'skipped', creditsUsed: 0, listingsAdded: 0, message: skipMsg };
    }

    // 1. Enforce dynamic credit budget
    const creditsUsedThisMonth = await this.getCreditsUsedThisMonth();
    if (creditsUsedThisMonth >= config.firecrawl.monthlyLimit && !force) {
      const skipMsg = `Crawler job skipped: monthly credit limit reached (${creditsUsedThisMonth}/${config.firecrawl.monthlyLimit}).`;
      console.log(`[CrawlerService] ${skipMsg}`);
      return { status: 'skipped', creditsUsed: 0, listingsAdded: 0, message: skipMsg };
    }

    const maxScrapes = await this.getDynamicCrawlBudget(force);
    if (maxScrapes === 0 && !force) {
      const skipMsg = 'Crawler job skipped: dynamic daily credit budget allocation reached for today.';
      console.log(`[CrawlerService] ${skipMsg}`);
      return { status: 'skipped', creditsUsed: 0, listingsAdded: 0, message: skipMsg };
    }

    // 2. Select crawl target using round-robin (least recently crawled target)
    const target = await this.selectNextCrawlTarget(force);
    if (!target) {
      const skipMsg = 'No eligible crawl targets ready or configured (all targets crawled within last 24 hours).';
      console.log(`[CrawlerService] ${skipMsg}`);
      return { status: 'skipped', creditsUsed: 0, listingsAdded: 0, message: skipMsg };
    }

    // Check if the source site is supported
    if (!config.crawler.supportedSites.includes('olx') && !force) {
      const skipMsg = `Crawl target OLX skipped: site 'olx' is not enabled in supported sites list (${config.crawler.supportedSites.join(', ')}).`;
      console.log(`[CrawlerService] ${skipMsg}`);
      return { status: 'skipped', creditsUsed: 0, listingsAdded: 0, message: skipMsg };
    }

    const targetName = `${target.locationName} - ${target.categorySlug}`;
    console.log(`[CrawlerService] Selected target: ${targetName}`);

    // Build the OLX URL: https://www.olx.in/<locationUrlSlug>/<categoryUrlSlug>
    const categoryUrl = `${this.olxSource.baseUrl}/${target.locationUrlSlug}/${target.categoryUrlSlug}`;
    let creditsUsed = 0;
    let listingsAdded = 0;

    try {
      // 3. Resolve location and category in our local database
      const dbLocation = await this.prisma.location.findFirst({
        where: { name: { equals: target.locationName, mode: 'insensitive' } }
      });
      const dbCategory = await this.prisma.category.findUnique({
        where: { slug: target.categorySlug }
      });

      if (!dbLocation || !dbCategory) {
        const errorMsg = `DB Lookup failed. Category found: ${!!dbCategory}, Location found: ${!!dbLocation}`;
        console.error(`[CrawlerService] ${errorMsg}`);
        await this.logCrawlResult(targetName, 0, 0, 'FAILED', errorMsg);
        return { status: 'failed', target: targetName, creditsUsed: 0, listingsAdded: 0, message: errorMsg };
      }

      // Resolve or create the system-crawler user
      const systemUser = await this.resolveSystemCrawlerUser();

      // 4. Fetch listing links from the category page (costs 1 credit)
      const listingUrls = await this.olxSource.getListingUrls(categoryUrl, 10);
      creditsUsed += 1;

      if (listingUrls.length === 0) {
        const warningMsg = 'No listing URLs found on category page.';
        console.warn(`[CrawlerService] ${warningMsg}`);
        await this.logCrawlResult(targetName, creditsUsed, 0, 'SUCCESS', warningMsg);
        return { status: 'success', target: targetName, creditsUsed, listingsAdded: 0, message: warningMsg };
      }

      // Limit the number of listings to process in a single run (budget control)
      const limit = force ? Math.min(listingUrls.length, config.firecrawl.maxItemsPerRun) : Math.min(listingUrls.length, maxScrapes);
      const urlsToScrape = listingUrls.slice(0, limit);
      let successfulItems = 0;
      let failedItems = 0;

      // 5. Process each listing page (costs 1 credit each)
      for (const url of urlsToScrape) {
        let detailCreditRecorded = false;

        try {
          console.log(`[CrawlerService] Checking listing URL: ${url}`);

          // Look up if listing already exists in database
          const existingListing = await this.prisma.listing.findUnique({
            where: { externalLink: url },
            include: { images: true }
          });

          // Fetch full listing details from OLX
          const crawledItem: CrawledListing = await this.olxSource.getListingDetails(
            url,
            target.locationName,
            target.categorySlug
          );
          creditsUsed += 1;
          detailCreditRecorded = true;

          if (existingListing) {
            const requiresRepair =
              existingListing.status !== ListingStatus.ACTIVE || existingListing.images.length === 0;

            // Check if details have actually changed
            const isUpdated = 
              existingListing.title !== crawledItem.title ||
              existingListing.description !== crawledItem.description ||
              Number(existingListing.price) !== crawledItem.price;

            if (!isUpdated && !requiresRepair) {
              console.log(`[CrawlerService] Content for listing "${crawledItem.title}" is unchanged. Skipping update.`);
              successfulItems += 1;
              continue;
            }

            console.log(`[CrawlerService] ${requiresRepair ? 'Repairing' : 'Updating'} listing "${crawledItem.title}".`);

            const imageBuffers = await this.downloadListingImages(crawledItem.images);
            if (imageBuffers.length === 0) {
              throw new Error(`No valid images available to refresh listing ${existingListing.id}.`);
            }

            const uploadedImages = await ImageService.prepareUploads(imageBuffers, { watermark: true });

            try {
              await this.prisma.$transaction(async (tx) => {
                if (existingListing.images.length > 0) {
                  await tx.image.deleteMany({
                    where: { id: { in: existingListing.images.map(img => img.id) } }
                  });
                }

                const finalSlug = this.generateSlug(crawledItem.title, existingListing.id);
                await tx.listing.update({
                  where: { id: existingListing.id },
                  data: {
                    title: crawledItem.title,
                    description: crawledItem.description,
                    price: crawledItem.price,
                    slug: finalSlug,
                    status: ListingStatus.ACTIVE
                  }
                });

                await ImageService.createImageRecords(tx as any, existingListing.id, uploadedImages);
              });
            } catch (error) {
              await ImageService.deleteStoredImagesByUrls(uploadedImages.map((image) => image.path));
              throw error;
            }

            if (existingListing.images.length > 0) {
              try {
                await ImageService.deleteStoredImagesByUrls(existingListing.images.map((image) => image.path));
              } catch (cleanupError) {
                console.error(`[CrawlerService] Failed to delete old stored images for listing ${existingListing.id}:`, cleanupError);
              }
            }

            listingsAdded += 1;
            successfulItems += 1;
            console.log(`[CrawlerService] Successfully updated listing ${existingListing.id}`);
            continue;
          }

          const imageBuffers = await this.downloadListingImages(crawledItem.images);

          if (imageBuffers.length === 0) {
            // Treat no-image new listings as a failure — the run should not be
            // considered a SUCCESS that resets the 24-hour target rotation timer
            // when no actual listing work was completed.
            console.warn(`[CrawlerService] Skipping listing "${crawledItem.title}" because no images could be processed.`);
            failedItems += 1;
            continue;
          }

          const uploadedImages = await ImageService.prepareUploads(imageBuffers, { watermark: true });

          try {
            await this.prisma.$transaction(async (tx) => {
              const listing = await tx.listing.create({
                data: {
                  title: crawledItem.title,
                  description: crawledItem.description,
                  price: crawledItem.price,
                  externalLink: crawledItem.externalLink,
                  status: ListingStatus.ACTIVE,
                  categoryId: dbCategory.id,
                  locationId: dbLocation.id,
                  userId: systemUser.id,
                  slug: 'crawler-temp-' + Date.now() + '-' + Math.floor(Math.random() * 1000)
                }
              });

              const finalSlug = this.generateSlug(listing.title, listing.id);
              await tx.listing.update({
                where: { id: listing.id },
                data: { slug: finalSlug }
              });

              await ImageService.createImageRecords(tx as any, listing.id, uploadedImages);
            });
          } catch (error) {
            await ImageService.deleteStoredImagesByUrls(uploadedImages.map((image) => image.path));
            throw error;
          }

          listingsAdded += 1;
          successfulItems += 1;
          console.log(`[CrawlerService] Successfully created listing ("${crawledItem.title}")`);
        } catch (itemError) {
          console.error(`[CrawlerService] Failed to process listing from URL ${url}:`, itemError);
          failedItems += 1;
          if (!detailCreditRecorded) {
            creditsUsed += 1;
          }
        }
      }

      if (failedItems > 0 && successfulItems === 0) {
        const failMsg = `Completed crawl run with no successful listing processing. Failed items: ${failedItems}.`;
        await this.logCrawlResult(targetName, creditsUsed, listingsAdded, 'FAILED', failMsg);
        return { status: 'failed', target: targetName, creditsUsed, listingsAdded, message: failMsg };
      }

      const successMsg = `Completed crawl run. Listings processed/added: ${listingsAdded}.`;
      await this.logCrawlResult(targetName, creditsUsed, listingsAdded, 'SUCCESS', successMsg);
      return { status: 'success', target: targetName, creditsUsed, listingsAdded, message: successMsg };
    } catch (error) {
      const failMsg = `Failed during crawl orchestration: ${(error as Error).message}`;
      console.error(`[CrawlerService] ${failMsg}`);
      await this.logCrawlResult(targetName, creditsUsed, listingsAdded, 'FAILED', failMsg);
      return { status: 'failed', target: targetName, creditsUsed, listingsAdded, message: failMsg };
    }
  }

  /**
   * Sums up all creditsUsed in crawlerLogs for the current calendar month.
   */
  private async getCreditsUsedThisMonth(): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const aggregate = await this.prisma.crawlerLog.aggregate({
      _sum: {
        creditsUsed: true
      },
      where: {
        timestamp: {
          gte: startOfMonth
        }
      }
    });

    return aggregate._sum.creditsUsed || 0;
  }

  /**
   * Decides which target to crawl next by looking at which one has the oldest successful log.
   * Enforces a 24-hour crawl spacing restriction per target.
   */
  private async selectNextCrawlTarget(force: boolean = false): Promise<CrawlTarget | null> {
    if (CRAWL_TARGETS.length === 0) return null;

    // Get the latest log timestamps for each target
    const targetLogs = await this.prisma.crawlerLog.groupBy({
      by: ['targetName'],
      _max: {
        timestamp: true
      },
      where: {
        status: 'SUCCESS'
      }
    });

    const logMap = new Map<string, Date>();
    targetLogs.forEach(log => {
      if (log._max.timestamp) {
        logMap.set(log.targetName, new Date(log._max.timestamp));
      }
    });

    // Find the target that has the oldest timestamp (or has never been crawled)
    let bestTarget: CrawlTarget | null = null;
    let oldestDate: Date | null = null;

    for (const target of CRAWL_TARGETS) {
      const targetName = `${target.locationName} - ${target.categorySlug}`;
      const lastCrawled = logMap.get(targetName);

      if (!lastCrawled) {
        // Has never been crawled, pick this target immediately!
        return target;
      }

      if (oldestDate === null || lastCrawled < oldestDate) {
        oldestDate = lastCrawled;
        bestTarget = target;
      }
    }

    // Check 24-hour limit
    if (bestTarget && oldestDate && !force) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (oldestDate > twentyFourHoursAgo) {
        console.log(`[CrawlerService] Selected target "${bestTarget.locationName} - ${bestTarget.categorySlug}" was crawled recently (${oldestDate.toISOString()}). 24-hour limit active.`);
        return null; // All targets have been crawled within the last 24 hours
      }
    }

    return bestTarget;
  }

  /**
   * Resolves the system crawler user in the user table, creating it if necessary.
   */
  private async resolveSystemCrawlerUser() {
    let systemUser = await this.prisma.user.findUnique({
      where: { userId: 'system-crawler' }
    });

    if (!systemUser) {
      systemUser = await this.prisma.user.create({
        data: {
          userId: 'system-crawler',
          username: 'locful_crawler',
          fullName: 'External Partner',
          email: 'crawler@locful.com',
          phone: '0000000000',
          avatar: 'https://res.cloudinary.com/aravin/image/upload/v1700000000/crawler_avatar.png',
          rewardPoints: 0,
        }
      });
      console.log('[CrawlerService] Created system-crawler user record.');
    }

    return systemUser;
  }

  /**
   * Logs a crawl run to the database.
   */
  private async logCrawlResult(targetName: string, creditsUsed: number, listingsAdded: number, status: 'SUCCESS' | 'FAILED', message?: string) {
    try {
      await this.prisma.crawlerLog.create({
        data: {
          targetName,
          creditsUsed,
          listingsAdded,
          status,
          message: message || null
        }
      });
    } catch (err) {
      console.error('[CrawlerService] Failed to write crawler log to database:', err);
    }
  }

  /**
   * Helper to generate unique SEO friendly slug.
   */
  private generateSlug(title: string, id: number): string {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(/-+/g, '-') // Replace multiple - with single -
      .trim();

    return `${baseSlug}-${id}`;
  }

  /**
   * Computes the dynamic crawl budget based on remaining Firecrawl credits
   * and the remaining days in the billing period.
   * Returns the maximum number of items to crawl in the current run.
   */
  private async getDynamicCrawlBudget(force: boolean): Promise<number> {
    const defaultMax = config.firecrawl.maxItemsPerRun; // default is 3
    
    try {
      const usage = await this.firecrawlClient.getCreditUsage();
      if (!usage) {
        console.log(`[CrawlerService] Could not retrieve Firecrawl credit usage. Falling back to default budget: ${defaultMax}`);
        return defaultMax;
      }

      const { remainingCredits, billingPeriodEnd } = usage;
      
      const billingEnd = new Date(billingPeriodEnd);
      const now = new Date();
      const msRemaining = billingEnd.getTime() - now.getTime();
      const daysRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

      // Calculate how many credits we can allocate for today
      const dailyCreditBudget = remainingCredits / daysRemaining;

      // Query how many credits we have already used in the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const aggregate = await this.prisma.crawlerLog.aggregate({
        _sum: {
          creditsUsed: true
        },
        where: {
          timestamp: {
            gte: oneDayAgo
          }
        }
      });
      const creditsUsedLast24h = aggregate._sum.creditsUsed || 0;

      // Available credits for the remainder of today
      const availableCreditsToday = Math.max(0, dailyCreditBudget - creditsUsedLast24h);

      console.log(`[CrawlerService] Dynamic crawl budget details:`);
      console.log(`  - Remaining Firecrawl credits: ${remainingCredits}`);
      console.log(`  - Days remaining in cycle: ${daysRemaining}`);
      console.log(`  - Daily credit allocation: ${dailyCreditBudget.toFixed(2)}`);
      console.log(`  - Credits used in last 24h: ${creditsUsedLast24h}`);
      console.log(`  - Available credits today: ${availableCreditsToday.toFixed(2)}`);

      if (availableCreditsToday < 2 && !force) {
        console.log(`[CrawlerService] Daily allocation exhausted. Skipping crawl run.`);
        return 0;
      }

      // Each crawl run costs 1 credit for search listing URLs + 1 credit per listing details page.
      // So N items cost N + 1 credits.
      const itemsToScrape = Math.max(1, Math.floor(availableCreditsToday - 1));
      
      // Cap at the configured max to prevent too many scrapes in a single run
      const finalItemsCount = Math.min(config.firecrawl.maxItemsPerRun, itemsToScrape);
      console.log(`[CrawlerService] Dynamic crawl budget allowed items to scrape: ${finalItemsCount}`);
      return finalItemsCount;
    } catch (err) {
      console.error('[CrawlerService] Error calculating dynamic crawl budget, falling back to default:', err);
      return defaultMax;
    }
  }
}
