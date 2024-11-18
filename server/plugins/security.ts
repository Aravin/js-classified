import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
// import helmet from '@fastify/helmet';

export async function configureSecurityPlugins(fastify: FastifyInstance) {
  // Disable helmet temporarily for debugging
  // await fastify.register(helmet, config.security.helmet)

  // Configure CORS
  await fastify.register(cors, {
    origin: true, // Allow all origins for now to debug
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
  });

  // Add CORS headers to all routes as a hook
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', request.headers.origin || 'http://localhost:5173');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    reply.header('Access-Control-Allow-Credentials', 'true');

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      reply.send();
    }
  });
}
