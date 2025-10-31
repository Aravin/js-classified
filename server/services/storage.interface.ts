/**
 * Storage Provider Interface
 * This abstraction allows switching between different storage providers
 * (Cloudinary, AWS S3, Cloudflare R2) without affecting business logic
 */

export interface UploadResult {
  url: string;
  publicId: string;
}

export interface ThumbnailResult {
  url: string;
}

export interface StorageProvider {
  /**
   * Upload an image file
   * @param buffer - Image file buffer
   * @param options - Upload options (width, height, quality, etc.)
   * @returns Promise with URL and public ID
   */
  upload(buffer: Buffer, options: UploadOptions): Promise<UploadResult>;

  /**
   * Generate a thumbnail URL from a public ID
   * @param publicId - The public ID of the image
   * @param options - Thumbnail options (width, height, quality)
   * @returns Promise with thumbnail URL
   */
  generateThumbnail(publicId: string, options: ThumbnailOptions): Promise<string>;

  /**
   * Delete an image by public ID
   * @param publicId - The public ID of the image
   * @returns Promise indicating success
   */
  delete(publicId: string): Promise<boolean>;

  /**
   * Check if a URL belongs to this provider
   * @param url - Image URL to check
   * @returns true if this provider can handle the URL
   */
  canHandleUrl(url: string): boolean;

  /**
   * Extract public ID from a URL
   * @param url - Image URL
   * @returns public ID or null if not found
   */
  extractPublicId(url: string): string | null;
}

export interface UploadOptions {
  folder?: string;
  width?: number;
  height?: number;
  quality?: number;
  allowedFormats?: string[];
}

export interface ThumbnailOptions {
  width: number;
  height: number;
  quality: number;
  format?: string;
}




