import { v2 as cloudinary } from 'cloudinary';
import { StorageProvider, UploadResult, UploadOptions, ThumbnailOptions } from '../storage.interface';
import { config } from '../../config/config';

export class CloudinaryProvider implements StorageProvider {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  canHandleUrl(url: string): boolean {
    // Check if URL is a Cloudinary URL
    return url.includes('res.cloudinary.com') || url.includes('cloudinary.com');
  }

  extractPublicId(url: string): string | null {
    try {
      // Extract public ID from Cloudinary URL format
      // https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{folder}/{public_id}.{format}
      const matches = url.match(/\/v\d+\/(.+?)\./);
      return matches ? matches[1] : null;
    } catch {
      return null;
    }
  }

  async upload(buffer: Buffer, options: UploadOptions): Promise<UploadResult> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const result = await new Promise<any>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: options.folder,
              resource_type: 'image',
              allowed_formats: options.allowedFormats,
              transformation: [{
                width: options.width,
                height: options.height,
                crop: 'fill',
                quality: options.quality,
                fetch_format: 'auto',
                flags: 'progressive'
              }],
              timeout: 60000,
            },
            (error, result) => {
              if (error) {
                reject(new Error(`Cloudinary upload failed: ${error.message}`));
              } else if (result) {
                resolve(result);
              } else {
                reject(new Error('No result from Cloudinary'));
              }
            }
          );

          uploadStream.on('error', (error) => {
            reject(new Error(`Upload stream error: ${error.message}`));
          });

          uploadStream.end(buffer);
        });

        return {
          url: result.secure_url,
          publicId: result.public_id,
        };
      } catch (error) {
        attempt++;
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    throw new Error('Upload failed after all retries');
  }

  async generateThumbnail(publicId: string, options: ThumbnailOptions): Promise<string> {
    return cloudinary.url(publicId, {
      width: options.width,
      height: options.height,
      crop: 'fill',
      quality: options.quality,
      format: options.format || 'webp'
    });
  }

  async delete(publicId: string): Promise<boolean> {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  }
}




