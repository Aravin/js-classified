import fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { configureSecurityPlugins } from './plugins/security';
import { listingRoutes } from './api/routes/listing.routes';
import { imageRoutes } from './api/routes/image.routes';
import { userRoutes } from './api/routes/user.routes';

import { config } from './config/config';

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

// Register routes
server.register(listingRoutes, { prefix: '/api/listings' });
server.register(imageRoutes, { prefix: '/api/images' });
server.register(userRoutes, { prefix: '/api/users' });


// Health check route
server.get('/ping', async () => 'pong\n');

const start = async () => {
  try {
    await server.listen({
      port: config.server.port,
      host: config.server.host,
    });
    console.log(`Server listening at ${config.server.host}:${config.server.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
