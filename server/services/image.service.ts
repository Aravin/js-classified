import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiOptions } from 'cloudinary';
import { config } from '../config/config';

// Initialize Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface CloudinaryResponse extends UploadApiResponse {
  public_id: string;
  secure_url: string;
}

interface CloudinaryOptions extends UploadApiOptions {
  folder?: string;
  resource_type?: 'auto' | 'image' | 'video' | 'raw';
  allowed_formats?: string[];
  transformation?: Array<{
    width?: number;
    height?: number;
    crop?: string;
    quality?: number;
    fetch_format?: string;
    flags?: string;
  }>;
}

const prisma = new PrismaClient();

export class ImageService {
  private static validateCloudinaryConfig() {
    const { cloud_name, api_key, api_secret } = cloudinary.config();
    if (!cloud_name || !api_key || !api_secret) {
      console.error('Cloudinary Config:', { cloud_name, api_key: !!api_key, api_secret: !!api_secret });
      throw new Error('Cloudinary configuration is incomplete. Please check your environment variables.');
    }
  }

  private static async uploadToCloudinary(file: Buffer, options: CloudinaryOptions): Promise<CloudinaryResponse> {
    this.validateCloudinaryConfig();
    
    console.log('Starting Cloudinary upload with options:', JSON.stringify(options));
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              ...options,
              timeout: 60000, // Increased timeout to 60 seconds
            },
            (error, result) => {
              if (error) {
                console.error(`Cloudinary upload error (attempt ${attempt + 1}/${maxRetries}):`, error);
                reject(new Error(`Cloudinary upload failed: ${error.message}`));
              } else if (result) {
                console.log('Cloudinary upload successful:', result.public_id);
                resolve(result as CloudinaryResponse);
              } else {
                console.error('No result from Cloudinary upload');
                reject(new Error('No result from Cloudinary'));
              }
            }
          );

          uploadStream.on('error', (error) => {
            console.error(`Upload stream error (attempt ${attempt + 1}/${maxRetries}):`, error);
            reject(new Error(`Upload stream error: ${error.message}`));
          });

          try {
            uploadStream.end(file);
          } catch (error) {
            console.error('Error writing to upload stream:', error);
            reject(new Error(`Error writing to upload stream: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        });
      } catch (error) {
        attempt++;
        if (attempt === maxRetries) {
          throw error;
        }
        console.log(`Retrying upload (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }
    throw new Error('Upload failed after all retries');
  }

  private static async generateThumbnail(publicId: string): Promise<string> {
    try {
      return cloudinary.url(publicId, {
        width: config.upload.thumbnailWidth,
        height: config.upload.thumbnailHeight,
        crop: 'fill',
        quality: config.upload.quality,
        format: 'webp'
      });
    } catch (error) {
      throw new Error(`Failed to generate thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async uploadImages(files: { buffer: Buffer; order: number }[], listingId: number): Promise<any[]> {
    console.log(`Starting upload of ${files.length} images for listing ${listingId}`);
    
    // Check Cloudinary config first
    this.validateCloudinaryConfig();
    
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
            
            // Upload image with optimized settings
            const result = await this.uploadToCloudinary(buffer, {
              folder: config.upload.folder,
              resource_type: 'image',
              allowed_formats: config.upload.allowedFormats,
              transformation: [{
                width: config.upload.mainImageWidth,
                height: config.upload.mainImageHeight,
                crop: 'fill',
                quality: config.upload.quality,
                fetch_format: 'auto',
                flags: 'progressive'
              }]
            });

            // Generate thumbnail URL
            const thumbnailUrl = await this.generateThumbnail(result.public_id);

            return {
              path: result.secure_url,
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
      if (error instanceof Error) {
        if (error.message.includes('CLOUDINARY')) {
          throw new Error(`Configuration error: ${error.message}`);
        } else if (error.message.includes('timeout')) {
          throw new Error('Upload timed out. Please try again.');
        }
      }
      throw error;
    }
  }

  static async deleteImages(imageIds: number[]) {
    try {
      if (!imageIds.length) {
        throw new Error('No image IDs provided');
      }

      // First get the Cloudinary public IDs
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

      // Delete from Cloudinary
      const deletePromises = images.map(async (image) => {
        const publicId = this.getPublicIdFromUrl(image.path);
        if (!publicId) {
          throw new Error(`Invalid Cloudinary URL format for image ID ${image.id}`);
        }
        return cloudinary.uploader.destroy(publicId);
      });

      // Delete from database
      await prisma.image.deleteMany({
        where: {
          id: {
            in: imageIds
          }
        }
      });

      await Promise.all(deletePromises);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static getPublicIdFromUrl(url: string): string | undefined {
    try {
      const matches = url.match(/\/v\d+\/(.+?)\./);
      return matches ? matches[1] : undefined;
    } catch {
      return undefined;
    }
  }
}