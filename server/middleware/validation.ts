import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

/**
 * A03 - Injection: Input validation middleware
 * Validates all inputs to prevent injection attacks
 */

// Common validation schemas
export const commonValidations = {
  id: z.coerce.number().int().positive(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
};

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate and sanitize query parameters
 */
export function validateQuery<T extends z.ZodTypeAny>(
  request: FastifyRequest,
  schema: T
): z.infer<T> {
  try {
    return schema.parse(request.query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid query parameters: ${error.issues.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Validate and sanitize body parameters
 */
export function validateBody<T extends z.ZodTypeAny>(
  request: FastifyRequest,
  schema: T
): z.infer<T> {
  try {
    const body = request.body;
    
    // Recursively sanitize string fields
    if (typeof body === 'object' && body !== null) {
      sanitizeObject(body);
    }
    
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid request body: ${error.issues.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Recursively sanitize object strings
 */
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

/**
 * A10 - SSRF: Validate URLs to prevent Server-Side Request Forgery
 */
export function validateUrl(url: string, allowedDomains?: string[]): URL {
  let parsedUrl: URL;
  
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Block private/internal IPs
  const hostname = parsedUrl.hostname;
  const isPrivate = 
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.16.') ||
    hostname.startsWith('172.17.') ||
    hostname.startsWith('172.18.') ||
    hostname.startsWith('172.19.') ||
    hostname.startsWith('172.20.') ||
    hostname.startsWith('172.21.') ||
    hostname.startsWith('172.22.') ||
    hostname.startsWith('172.23.') ||
    hostname.startsWith('172.24.') ||
    hostname.startsWith('172.25.') ||
    hostname.startsWith('172.26.') ||
    hostname.startsWith('172.27.') ||
    hostname.startsWith('172.28.') ||
    hostname.startsWith('172.29.') ||
    hostname.startsWith('172.30.') ||
    hostname.startsWith('172.31.') ||
    hostname.endsWith('.local');

  if (isPrivate) {
    throw new Error('URL points to internal/private network');
  }

  // Validate protocol
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only HTTP and HTTPS protocols are allowed');
  }

  // Validate allowed domains if specified
  if (allowedDomains && allowedDomains.length > 0) {
    const domain = parsedUrl.hostname;
    const isAllowed = allowedDomains.some(allowed => 
      domain === allowed || domain.endsWith(`.${allowed}`)
    );
    
    if (!isAllowed) {
      throw new Error('URL domain not in allowed list');
    }
  }

  return parsedUrl;
}

