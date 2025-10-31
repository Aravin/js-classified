import { StorageProvider } from './storage.interface';
import { CloudinaryProvider } from './providers/cloudinary.provider';

export enum StorageProviderType {
  CLOUDINARY = 'cloudinary',
  AWS_S3 = 'aws-s3',
  CLOUDFLARE_R2 = 'cloudflare-r2',
}

/**
 * Factory for creating storage providers
 * Easy to add new providers in the future
 */
export function createStorageProvider(): StorageProvider {
  const providerType = process.env.STORAGE_PROVIDER?.toLowerCase() || StorageProviderType.CLOUDINARY;

  switch (providerType) {
    case StorageProviderType.CLOUDINARY:
      return new CloudinaryProvider();
    
    case StorageProviderType.AWS_S3:
      throw new Error('AWS S3 provider not yet implemented. Use Cloudinary for now.');
    
    case StorageProviderType.CLOUDFLARE_R2:
      throw new Error('Cloudflare R2 provider not yet implemented. Use Cloudinary for now.');
    
    default:
      console.warn(`Unknown storage provider: ${providerType}. Falling back to Cloudinary.`);
      return new CloudinaryProvider();
  }
}




