import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { createListingSchema, updateListingSchema } from '../schemas/listing.schema'
import { z } from 'zod'

const prisma = new PrismaClient()

function generateSlug(title: string, id: number): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/-+/g, '-') // Replace multiple - with single -
    .trim()
  
  return `${baseSlug}-${id}`
}

export async function listingRoutes(fastify: FastifyInstance) {
  // Create a new listing
  fastify.post('/', async (request, reply) => {
    try {
      const data = createListingSchema.parse(request.body)
      
      const listing = await prisma.listing.create({
        data: {
          ...data,
          // Temporarily set a placeholder slug as we need the ID first
          slug: 'temp-slug',
          images: data.images ? {
            create: data.images
          } : undefined
        },
        include: {
          category: true,
          location: true,
          images: true
        }
      })

      // Update with the final slug using the ID
      const finalListing = await prisma.listing.update({
        where: { id: listing.id },
        data: {
          slug: generateSlug(data.title, listing.id)
        },
        include: {
          category: true,
          location: true,
          images: true
        }
      })
      
      return reply.status(201).send(finalListing)
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // Get all listings
  fastify.get('/', async (request, reply) => {
    const { categoryId, locationId, status } = request.query as any
    const listings = await prisma.listing.findMany({
      where: {
        ...(categoryId ? { categoryId: parseInt(categoryId) } : {}),
        ...(locationId ? { locationId: parseInt(locationId) } : {}),
        ...(status ? { status } : {})
      },
      include: {
        category: true,
        location: true,
        images: true
      }
    })
    return listings
  })

  // Get single listing
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const listing = await prisma.listing.findUnique({
      where: { id: parseInt(id) },
      include: {
        category: true,
        location: true,
        images: true
      }
    })
    
    if (!listing) {
      reply.status(404).send({ error: 'Listing not found' })
      return
    }
    
    return listing
  })

  // Update listing
  fastify.patch('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updateListingSchema.parse(request.body)
      const numericId = parseInt(id)
      
      const listing = await prisma.listing.update({
        where: { id: numericId },
        data: {
          ...data,
          // Only update slug if title changes
          slug: data.title ? generateSlug(data.title, numericId) : undefined,
          images: data.images ? {
            deleteMany: {},
            create: data.images
          } : undefined
        },
        include: {
          category: true,
          location: true,
          images: true
        }
      })
      
      return listing
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // Delete listing
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.listing.delete({
      where: { id: parseInt(id) }
    })
    return { success: true }
  })
}