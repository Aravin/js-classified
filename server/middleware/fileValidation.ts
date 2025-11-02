import { FastifyRequest, FastifyReply } from 'fastify';
import { MultipartFile } from '@fastify/multipart';
import { securityConfig } from '../config/security';

/**
 * A02 - Cryptographic Failures: File upload security
 * A03 - Injection: File validation
 */

/**
 * Validate uploaded file
 */
export async function validateFile(
  file: MultipartFile
): Promise<{ valid: boolean; error?: string }> {
  // Check file size
  if (file.file?.bytesRead && file.file.bytesRead > securityConfig.maxFileSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${securityConfig.maxFileSize / 1024 / 1024}MB`,
    };
  }

  // Validate MIME type
  const mimeType = file.mimetype;
  if (!securityConfig.allowedMimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `File type ${mimeType} is not allowed. Allowed types: ${securityConfig.allowedMimeTypes.join(', ')}`,
    };
  }

  // Additional validation: Check file extension matches MIME type
  const extension = file.filename?.split('.').pop()?.toLowerCase();
  const mimeExtensions: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'image/gif': ['gif'],
  };

  if (extension && mimeExtensions[mimeType]) {
    if (!mimeExtensions[mimeType].includes(extension)) {
      return {
        valid: false,
        error: `File extension .${extension} does not match MIME type ${mimeType}`,
      };
    }
  }

  return { valid: true };
}

/**
 * A03 - Injection: Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace unsafe characters
    .replace(/\.\./g, '_') // Prevent path traversal
    .substring(0, 255) // Limit length
    .trim();
}

