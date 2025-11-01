import fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { configureSecurityPlugins } from './plugins/security';
import { listingRoutes } from './api/routes/listing.routes';
import { imageRoutes } from './api/routes/image.routes';
import { userRoutes } from './api/routes/user.routes';

import { config, validateEnvConfig } from './config/config';

// Validate environment variables before starting
validateEnvConfig();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const server = fastify({
  logger: true,
});

// Initialize Prisma
const prisma = new PrismaClient();

// Decorate fastify with prisma
server.decorate('prisma', prisma);

// Add close hook to disconnect Prisma
server.addHook('onClose', async (instance) => {
  await instance.prisma.$disconnect();
});

// Configure security plugins
server.register(configureSecurityPlugins);

// Register routes with /api prefix (for backward compatibility)
server.register(listingRoutes, { prefix: '/api/listings' });
server.register(imageRoutes, { prefix: '/api/images' });
server.register(userRoutes, { prefix: '/api/users' });

// Register routes without /api prefix (for api.locful.com domain)
server.register(listingRoutes, { prefix: '/listings' });
server.register(imageRoutes, { prefix: '/images' });
server.register(userRoutes, { prefix: '/users' });


// Health check route with connection checks
server.get('/health', async (request, reply) => {
  const { checks: checksParam } = request.query as { checks?: string };

  // Default: just return OK with timestamp
  if (checksParam !== 'true') {
    return reply.code(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }

  // If checks=true, do all connection checks
  const checks: Record<string, { status: string; message?: string }> = {};
  let overallStatus = 'ok';

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', message: 'Database connection successful' };
  } catch (error) {
    checks.database = { status: 'error', message: `Database connection failed: ${(error as Error).message}` };
    overallStatus = 'error';
  }

  // Check Cloudinary configuration
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (cloudName && apiKey && apiSecret) {
      checks.cloudinary = { status: 'ok', message: 'Cloudinary configured' };
    } else {
      checks.cloudinary = { status: 'error', message: 'Cloudinary not configured' };
      overallStatus = 'error';
    }
  } catch (error) {
    checks.cloudinary = { status: 'error', message: `Cloudinary check failed: ${(error as Error).message}` };
    overallStatus = 'error';
  }

  const statusCode = overallStatus === 'ok' ? 200 : 503;
  return reply.code(statusCode).send({
    status: overallStatus,
    checks,
    timestamp: new Date().toISOString(),
  });
});

const start = async () => {
  try {
    const address = await server.listen({
      port: config.server.port,
      host: config.server.host,
    });
    console.log(`✅ Server listening at ${address}`);
    console.log(`📡 Health check available at ${address}/health`);
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    server.log.error(err);
    process.exit(1);
  }
};

start();
