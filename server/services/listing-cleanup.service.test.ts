import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListingCleanupService } from './listing-cleanup.service';
import { ListingStatus } from '@prisma/client';

// Mock ImageService
vi.mock('./image.service', () => {
  return {
    ImageService: {
      deleteImages: vi.fn().mockResolvedValue(true)
    }
  };
});

import { ImageService } from './image.service';

describe('ListingCleanupService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      listing: {
        updateMany: vi.fn().mockResolvedValue({ count: 5 }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 1,
            title: 'Old Listing 1',
            images: [{ id: 10, path: 'https://example.com/img1.jpg' }]
          },
          {
            id: 2,
            title: 'Old Listing 2',
            images: []
          }
        ]),
        delete: vi.fn().mockResolvedValue({})
      }
    };
  });

  it('successfully updates and deletes expired listings', async () => {
    const cleanupService = new ListingCleanupService(mockPrisma);
    const result = await cleanupService.cleanupListings();

    expect(result.status).toBe('success');
    expect(result.markedInactive).toBe(5);
    expect(result.deletedCount).toBe(2);

    // Verify updateMany was called to mark older active listings as ENDED
    expect(mockPrisma.listing.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ListingStatus.ACTIVE,
          externalLink: { not: null }
        }),
        data: {
          status: ListingStatus.ENDED
        }
      })
    );

    // Verify findMany was called to query listings to delete
    expect(mockPrisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          externalLink: { not: null }
        })
      })
    );

    // Verify ImageService.deleteImages was called for the listing with images (id: 1 has image 10)
    expect(ImageService.deleteImages).toHaveBeenCalledWith(mockPrisma, [10]);

    // Verify listing deletion was triggered for both retrieved listings
    expect(mockPrisma.listing.delete).toHaveBeenCalledTimes(2);
    expect(mockPrisma.listing.delete).toHaveBeenNthCalledWith(1, { where: { id: 1 } });
    expect(mockPrisma.listing.delete).toHaveBeenNthCalledWith(2, { where: { id: 2 } });
  });

  it('handles database failures gracefully', async () => {
    mockPrisma.listing.updateMany.mockRejectedValue(new Error('DB failure'));

    const cleanupService = new ListingCleanupService(mockPrisma);
    const result = await cleanupService.cleanupListings();

    expect(result.status).toBe('failed');
    expect(result.markedInactive).toBe(0);
    expect(result.deletedCount).toBe(0);
  });

  it('does not delete the listing record when image cleanup fails', async () => {
    (ImageService.deleteImages as any).mockRejectedValueOnce(new Error('storage failure'));

    const cleanupService = new ListingCleanupService(mockPrisma);
    const result = await cleanupService.cleanupListings();

    expect(result.status).toBe('failed');
    expect(mockPrisma.listing.delete).not.toHaveBeenCalled();
  });

  it('returns success with zero counts when there is nothing to clean up', async () => {
    mockPrisma.listing.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.listing.findMany.mockResolvedValue([]);

    const cleanupService = new ListingCleanupService(mockPrisma);
    const result = await cleanupService.cleanupListings();

    expect(result.status).toBe('success');
    expect(result.markedInactive).toBe(0);
    expect(result.deletedCount).toBe(0);
    expect(ImageService.deleteImages).not.toHaveBeenCalled();
    expect(mockPrisma.listing.delete).not.toHaveBeenCalled();
  });

  it('deletes DB record for listings that have no images without calling ImageService', async () => {
    // A listing with zero images should be deleted from DB
    // but should NOT attempt to call ImageService.deleteImages.
    mockPrisma.listing.findMany.mockResolvedValue([
      { id: 5, title: 'Image-less listing', images: [] }
    ]);

    const cleanupService = new ListingCleanupService(mockPrisma);
    const result = await cleanupService.cleanupListings();

    expect(result.status).toBe('success');
    expect(result.deletedCount).toBe(1);
    expect(ImageService.deleteImages).not.toHaveBeenCalled();
    expect(mockPrisma.listing.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  it('only targets crawled listings (externalLink not null) for both inactivation and deletion', async () => {
    const cleanupService = new ListingCleanupService(mockPrisma);
    await cleanupService.cleanupListings();

    // updateMany filter must include externalLink: { not: null }
    expect(mockPrisma.listing.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          externalLink: { not: null }
        })
      })
    );

    // findMany filter must also include externalLink: { not: null }
    expect(mockPrisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          externalLink: { not: null }
        })
      })
    );
  });
});
