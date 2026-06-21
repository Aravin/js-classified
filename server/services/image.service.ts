import { PrismaClient } from '@prisma/client';
import { config } from '../config/config';
import { StorageProvider } from './storage.interface';
import { createStorageProvider } from './storage.factory';
import { applyWatermark } from '../utils/watermark';

// Get the storage provider (Cloudinary, AWS S3, or Cloudflare R2)
const storageProvider: StorageProvider = createStorageProvider();

interface PreparedImageUpload {
  path: string;
  thumbnailPath: string;
  order: number;
  publicId: string;
}

export class ImageService {
  static async prepareUploads(
    files: { buffer: Buffer; order: number }[],
    options?: { watermark?: boolean }
  ): Promise<PreparedImageUpload[]> {
    const concurrencyLimit = 2;
    const uploadResults: PreparedImageUpload[] = [];

    for (let i = 0; i < files.length; i += concurrencyLimit) {
      const batch = files.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(async ({ buffer, order }) => {
        console.log(`Processing image ${order}, size: ${buffer.length} bytes`);

        let uploadBuffer = buffer;
        if (options?.watermark && !storageProvider.supportsWatermark) {
          console.log('Provider does not support native watermarking, applying local watermark');
          uploadBuffer = await applyWatermark(buffer);
        }

        const result = await storageProvider.upload(uploadBuffer, {
          folder: config.upload.folder,
          width: config.upload.mainImageWidth,
          height: config.upload.mainImageHeight,
          quality: config.upload.quality,
          allowedFormats: config.upload.allowedFormats,
          watermark: options?.watermark,
        });

        const thumbnailUrl = await storageProvider.generateThumbnail(result.publicId, {
          width: config.upload.thumbnailWidth,
          height: config.upload.thumbnailHeight,
          quality: config.upload.quality,
          format: 'webp'
        });

        return {
          path: result.url,
          thumbnailPath: thumbnailUrl,
          order,
          publicId: result.publicId
        };
      });

      uploadResults.push(...await Promise.all(batchPromises));
    }

    return uploadResults;
  }

  static async createImageRecords(
    prisma: PrismaClient | any,
    listingId: number,
    uploads: PreparedImageUpload[]
  ): Promise<any[]> {
    const createOperations = uploads.map(({ path, thumbnailPath, order }) =>
      prisma.image.create({
        data: { path, thumbnailPath, order, listingId }
      })
    );

    return typeof prisma.$transaction === 'function'
      ? await prisma.$transaction(createOperations)
      : await Promise.all(createOperations);
  }

  static async uploadImages(
    prisma: PrismaClient | any,
    files: { buffer: Buffer; order: number }[],
    listingId: number,
    options?: { watermark?: boolean }
  ): Promise<any[]> {
    console.log(`Starting upload of ${files.length} images for listing ${listingId}`);
    let uploadResults: PreparedImageUpload[] = [];
    
    try {
      uploadResults = await this.prepareUploads(files, options);
      console.log('Creating database records for', uploadResults.length, 'images');
      const images = await this.createImageRecords(prisma, listingId, uploadResults);

      console.log(`Successfully processed ${images.length} images`);
      return images;
    } catch (error) {
      if (uploadResults.length > 0) {
        await this.deleteStoredImagesByUrls(uploadResults.map((image) => image.path));
      }
      console.error('Error in upload process:', error);
      throw error;
    }
  }

  static async deleteImages(prisma: PrismaClient, imageIds: number[]) {
    try {
      if (!imageIds.length) {
        throw new Error('No image IDs provided');
      }

      // Get images from database
      const images = await prisma.image.findMany({
        where: {
          id: {
            in: imageIds
          }
        }
      });

      if (!images.length) {
        throw new Error('No images found with the provided IDs');
      }

      // Delete from storage provider
      const deleteResults = await Promise.all(images.map(async (image) => {
        // Find the provider that can handle this URL
        const publicId = storageProvider.extractPublicId(image.path);
        if (!publicId) {
          throw new Error(`Could not extract public ID from URL: ${image.path}`);
        }
        const deleted = await storageProvider.delete(publicId);
        if (!deleted) {
          throw new Error(`Storage provider failed to delete image: ${image.path}`);
        }
        return deleted;
      }));

      if (deleteResults.length !== images.length) {
        throw new Error('Not all images were deleted from storage');
      }

      // Delete from database
      await prisma.image.deleteMany({
        where: {
          id: {
            in: imageIds
          }
        }
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to delete images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async deleteStoredImagesByUrls(urls: string[]) {
    const publicIds = Array.from(new Set(urls
      .map((url) => storageProvider.extractPublicId(url))
      .filter((publicId): publicId is string => !!publicId)));

    if (!publicIds.length) {
      return;
    }

    const results = await Promise.all(publicIds.map((publicId) => storageProvider.delete(publicId)));
    if (results.some((deleted) => !deleted)) {
      throw new Error('Failed to delete one or more stored images');
    }
  }
}
