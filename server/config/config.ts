interface RequiredEnvVars {
  DATABASE_URL?: string;
  STORAGE_PROVIDER?: string; // Optional: 'cloudinary' (default), 'aws-s3', 'cloudflare-r2'
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
}

const requiredEnvVars: (keyof RequiredEnvVars)[] = [
  'DATABASE_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

// Only require Cloudinary env vars if Cloudinary is the selected provider
const storageProvider = process.env.STORAGE_PROVIDER?.toLowerCase() || 'cloudinary';
if (storageProvider === 'cloudinary') {
  requiredEnvVars.push('CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET');
}

/**
 * Validates that all required environment variables are present
 * Exits the process if any are missing
 */
export function validateEnvConfig(): void {
  const missing: string[] = [];

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (!value || value.trim() === '') {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    console.error('');
    missing.forEach(variable => {
      console.error(`   - ${variable}`);
    });
    console.error('');
    console.error('Please check your .env file and ensure all required variables are set.');
    console.error('See .env.example for reference.');
    process.exit(1);
  }

  console.log('✅ All required environment variables are set');
}

export const config = {
  server: {
    port: Number(process.env.PORT) || 8080,
    host: process.env.HOST || '::',
  },
  cors: {
    origin: process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(url => url.trim())
      : ['http://localhost:5173'],  // Default to localhost for development
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  },
  security: {
    helmet: {
      contentSecurityPolicy: false,
    },
  },
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 5,
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    thumbnailWidth: 300,
    thumbnailHeight: 300,
    mainImageWidth: 1200,
    mainImageHeight: 800,
    quality: 80,
    folder: 'classified'
  }
};
