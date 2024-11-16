import { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { config } from '../config/config'

export async function configureSecurityPlugins(fastify: FastifyInstance) {
  // Disable helmet temporarily for debugging
  // await fastify.register(helmet, config.security.helmet)

  await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: false,
    maxAge: 86400,
  })

  // Register other security plugins if needed
}