export const config = {
  server: {
    port: Number(process.env.PORT) || 8080,
    host: process.env.HOST || '::',
  },
  cors: {
    origin: ['http://localhost:5173'],  // Your frontend URL
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
