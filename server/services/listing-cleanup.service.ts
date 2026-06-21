import { PrismaClient, ListingStatus } from '@prisma/client';
import { config } from '../config/config';
import { ImageService } from './image.service';

export class ListingCleanupService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Main cleanup task to:
   * 1. Mark listings older than LISTING_INACTIVE_DAYS (30 days) as ENDED.
   * 2. Delete listings older than LISTING_DELETE_DAYS (45 days) from database and storage.
   */
  async cleanupListings(): Promise<{
    status: 'success' | 'failed';
    markedInactive: number;
    deletedCount: number;
  }> {
    console.log('[ListingCleanupService] Starting listing cleanup job...');
    const inactiveDays = config.cron.inactiveDays;
    const deleteDays = config.cron.deleteDays;

    const now = new Date();
    const inactiveCutoff = new Date(now.getTime() - inactiveDays * 24 * 60 * 60 * 1000);
    const deleteCutoff = new Date(now.getTime() - deleteDays * 24 * 60 * 60 * 1000);

    let markedInactive = 0;
    let deletedCount = 0;

    try {
      // 1. Mark listings older than 30 days as ENDED
      const updateResult = await this.prisma.listing.updateMany({
        where: {
          status: ListingStatus.ACTIVE,
          externalLink: { not: null },
          OR: [
            { republishedAt: { lt: inactiveCutoff } },
            { republishedAt: null, createdAt: { lt: inactiveCutoff } }
          ]
        },
        data: {
          status: ListingStatus.ENDED
        }
      });
      markedInactive = updateResult.count;
      console.log(`[ListingCleanupService] Marked ${markedInactive} listings as ENDED.`);

      // 2. Find listings older than 45 days to delete
      const listingsToDelete = await this.prisma.listing.findMany({
        where: {
          externalLink: { not: null },
          OR: [
            { republishedAt: { lt: deleteCutoff } },
            { republishedAt: null, createdAt: { lt: deleteCutoff } }
          ]
        },
        include: {
          images: true
        }
      });

      console.log(`[ListingCleanupService] Found ${listingsToDelete.length} listings to delete.`);

      for (const listing of listingsToDelete) {
        // Delete images from storage first
        if (listing.images.length > 0) {
          const imageIds = listing.images.map(img => img.id);
          await ImageService.deleteImages(this.prisma, imageIds);
          console.log(`  - Deleted ${imageIds.length} images for listing ${listing.id} from storage and DB.`);
        }

        // Delete the listing record (cascades database-level foreign key relations)
        await this.prisma.listing.delete({
          where: { id: listing.id }
        });
        deletedCount++;
        console.log(`  - Deleted listing record ${listing.id} ("${listing.title}")`);
      }

      console.log(`[ListingCleanupService] Listing cleanup job finished successfully.`);
      return { status: 'success', markedInactive, deletedCount };
    } catch (err) {
      console.error('[ListingCleanupService] Listing cleanup job failed:', err);
      return { status: 'failed', markedInactive, deletedCount };
    }
  }
}
