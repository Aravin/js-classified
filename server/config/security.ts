/**
 * A02 - Cryptographic Failures: Security configuration
 * Ensures proper encryption, secrets management, and cryptographic practices
 */

/**
 * Validate that required security environment variables are set
 */
export function validateSecurityConfig(): void {
  const required = [
    'DATABASE_URL',
    'CLOUDINARY_API_SECRET',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required security environment variables: ${missing.join(', ')}\n` +
      'A02 - Cryptographic Failures: All secrets must be set via environment variables.'
    );
  }

  // A02 - Cryptographic Failures: Ensure HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    const protocol = process.env.PROTOCOL || 'http';
    if (protocol !== 'https') {
      console.warn(
        '⚠️  SECURITY WARNING: Not using HTTPS in production!\n' +
        'A02 - Cryptographic Failures: All production traffic must use HTTPS.'
      );
    }
  }

  // A02 - Cryptographic Failures: Validate secret complexity
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (apiSecret && apiSecret.length < 16) {
    console.warn(
      '⚠️  SECURITY WARNING: API secret is too short (minimum 16 characters recommended)'
    );
  }
}

/**
 * A02 - Cryptographic Failures: Get secure configuration
 */
export const securityConfig = {
  // Force HTTPS redirect in production
  forceHttps: process.env.NODE_ENV === 'production',
  
  // Session security
  sessionSecret: process.env.SESSION_SECRET || 'change-me-in-production',
  sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 hours
  
  // JWT settings
  jwtExpiry: parseInt(process.env.JWT_EXPIRY || '3600'), // 1 hour
  
  // Password requirements (for future user accounts)
  passwordMinLength: 12,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecial: true,
  
  // Rate limiting
  rateLimitWindow: 60000, // 1 minute
  rateLimitMax: 100,
  
  // File upload security
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ],
  
  // CORS origins (from env)
  corsOrigins: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:5173'],
};


