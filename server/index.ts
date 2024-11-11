import fastify from 'fastify'

const server = fastify()

server.get('/ping', async (request, reply) => {
  return 'pong 6 \n'
})

server.listen({ port: 8080, host: '::' }, (err, address) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Server listening at ${address}`)
})