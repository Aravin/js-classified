import { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { config } from '../config/config'

export async function configureSecurityPlugins(fastify: FastifyInstance) {
  // Register CORS
  await fastify.register(cors, config.cors)

  // Register Helmet
  await fastify.register(helmet, config.security.helmet)
}