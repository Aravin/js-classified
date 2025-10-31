import { PrismaClient } from '@prisma/client';
import { config } from '../config/config';
import { StorageProvider } from './storage.interface';
import { createStorageProvider } from './storage.factory';

const prisma = new PrismaClient();

// Get the storage provider (Cloudinary, AWS S3, or Cloudflare R2)
const storageProvider: StorageProvider = createStorageProvider();

export class ImageService {
  static async uploadImages(files: { buffer: Buffer; order: number }[], listingId: number): Promise<any[]> {
    console.log(`Starting upload of ${files.length} images for listing ${listingId}`);
    
    try {
      // Process images in parallel with a concurrency limit
      const concurrencyLimit = 2; // Process 2 images at a time
      const uploadResults = [];
      
      // Process files in batches
      for (let i = 0; i < files.length; i += concurrencyLimit) {
        const batch = files.slice(i, i + concurrencyLimit);
        const batchPromises = batch.map(async ({ buffer, order }) => {
          try {
            console.log(`Processing image ${order}, size: ${buffer.length} bytes`);
            
            // Upload image using the storage provider
            const result = await storageProvider.upload(buffer, {
              folder: config.upload.folder,
              width: config.upload.mainImageWidth,
              height: config.upload.mainImageHeight,
              quality: config.upload.quality,
              allowedFormats: config.upload.allowedFormats,
            });

            // Generate thumbnail URL
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
              listingId
            };
          } catch (error) {
            console.error(`Failed to upload image ${order}:`, error);
            throw error;
          }
        });

        // Wait for current batch to complete
        const batchResults = await Promise.all(batchPromises);
        uploadResults.push(...batchResults);
      }
      
      // Create database records in a single transaction
      console.log('Creating database records for', uploadResults.length, 'images');
      const images = await prisma.$transaction(
        uploadResults.map(data => prisma.image.create({ data }))
      );

      console.log(`Successfully processed ${images.length} images`);
      return images;
    } catch (error) {
      console.error('Error in upload process:', error);
      throw error;
    }
  }

  static async deleteImages(imageIds: number[]) {
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
      const deletePromises = images.map(async (image) => {
        // Find the provider that can handle this URL
        const publicId = storageProvider.extractPublicId(image.path);
        if (!publicId) {
          console.warn(`Could not extract public ID from URL: ${image.path}`);
          return false;
        }
        return await storageProvider.delete(publicId);
      });

      await Promise.all(deletePromises);

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
}
