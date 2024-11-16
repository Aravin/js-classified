import fastify from 'fastify'
import { configureSecurityPlugins } from './plugins/security'
import { listingRoutes } from './api/routes/listing.routes'
import { config } from './config/config'

const server = fastify({
  logger: true
})

// Configure security plugins
server.register(configureSecurityPlugins)

// Register routes
server.register(listingRoutes, { prefix: '/api/listings' })

// Health check route
server.get('/ping', async () => 'pong\n')

const start = async () => {
  try {
    await server.listen({
      port: config.server.port,
      host: config.server.host
    })
    console.log(`Server listening at ${server.server.address()}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()