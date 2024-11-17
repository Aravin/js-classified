import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import {
  createListingSchema,
  updateListingSchema,
  listingQuerySchema,
} from '../schemas/listing.schema';
import { z } from 'zod';

const prisma = new PrismaClient();

function generateSlug(title: string, id: number): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/-+/g, '-') // Replace multiple - with single -
    .trim();

  return `${baseSlug}-${id}`;
}

// Helper function to mask sensitive data
function maskSensitiveData(listing: any) {
  const { email, phone, ...rest } = listing;
  return {
    ...rest,
    hasEmail: !!email,
    hasPhone: !!phone,
  };
}

// Helper function to set CORS headers and send response
function sendResponse(reply: any, statusCode: number, data: any) {
  return reply.code(statusCode).header('Access-Control-Allow-Origin', '*').send(data);
}

export async function listingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request, reply) => {
    // Ensure CORS headers are set for every response
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  });

  // Create a new listing
  fastify.post('/', async (request, reply) => {
    try {
      const data = createListingSchema.parse(request.body);

      const listing = await prisma.listing.create({
        data: {
          ...data,
          slug: 'temp-slug',
          images: data.images
            ? {
                create: data.images,
              }
            : undefined,
        },
        include: {
          category: true,
          location: true,
          images: true,
        },
      });

      const finalListing = await prisma.listing.update({
        where: { id: listing.id },
        data: {
          slug: generateSlug(data.title, listing.id),
        },
        include: {
          category: true,
          location: true,
          images: true,
        },
      });

      return sendResponse(reply, 201, finalListing);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendResponse(reply, 400, { error: error.errors });
      }
      throw error;
    }
  });

  // Get all listings with pagination and filters
  fastify.get('/', async (request, reply) => {
    try {
      const query = listingQuerySchema.parse(request.query);
      const {
        page,
        limit,
        categoryId,
        locationId,
        sortBy,
        order,
        search,
        minPrice,
        maxPrice,
        hasImages,
      } = query;

      // Calculate skip for pagination
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {
        ...(categoryId ? { categoryId } : {}),
        ...(locationId ? { locationId } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(minPrice || maxPrice
          ? {
              price: {
                ...(minPrice ? { gte: minPrice } : {}),
                ...(maxPrice ? { lte: maxPrice } : {}),
              },
            }
          : {}),
        ...(hasImages
          ? {
              images: {
                some: {}, // At least one image exists
              },
            }
          : {}),
      };

      // Get total count for pagination
      const total = await prisma.listing.count({ where });

      // Get paginated results
      const listings = await prisma.listing.findMany({
        where,
        include: {
          category: true,
          location: true,
          images: true,
        },
        orderBy: [
          { [sortBy]: order },
          { createdAt: 'desc' }, // Secondary sort by createdAt
        ],
        skip,
        take: limit,
      });

      const maskedListings = listings.map(maskSensitiveData);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasMore = page < totalPages;
      const nextPage = hasMore ? page + 1 : null;
      const prevPage = page > 1 ? page - 1 : null;

      return sendResponse(reply, 200, {
        data: maskedListings,
        pagination: {
          total,
          totalPages,
          currentPage: page,
          limit,
          hasMore,
          nextPage,
          prevPage,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendResponse(reply, 400, { error: error.errors });
      }
      throw error;
    }
  });

  // Get single listing
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      // Check if id is a number or a slug
      const isNumericId = /^\d+$/.test(id);

      let listing;
      if (isNumericId) {
        const numericId = parseInt(id);
        listing = await prisma.listing.findUnique({
          where: { id: numericId },
          include: {
            category: true,
            location: true,
            images: true,
          },
        });
      } else {
        // If not numeric, treat as slug
        listing = await prisma.listing.findUnique({
          where: { slug: id },
          include: {
            category: true,
            location: true,
            images: true,
          },
        });
      }

      if (!listing) {
        return sendResponse(reply, 404, { error: 'Listing not found' });
      }

      return sendResponse(reply, 200, maskSensitiveData(listing));
    } catch (error) {
      console.error('Error fetching listing:', error);
      return sendResponse(reply, 500, { error: 'Internal server error' });
    }
  });

  // Get listing contact information
  fastify.get('/:id/contact', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const numericId = parseInt(id);
      const listing = await prisma.listing.findUnique({
        where: { id: numericId },
        select: {
          id: true,
          email: true,
          phone: true,
        },
      });

      if (!listing) {
        return sendResponse(reply, 404, { error: 'Listing not found' });
      }

      return sendResponse(reply, 200, {
        id: listing.id,
        contactInfo: {
          email: listing.email,
          phone: listing.phone,
        },
      });
    } catch (error) {
      throw error;
    }
  });

  // Update listing
  fastify.patch('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateListingSchema.parse(request.body);
      const numericId = parseInt(id);

      const listing = await prisma.listing.update({
        where: { id: numericId },
        data: {
          ...data,
          slug: data.title ? generateSlug(data.title, numericId) : undefined,
          images: data.images
            ? {
                deleteMany: {},
                create: data.images,
              }
            : undefined,
        },
        include: {
          category: true,
          location: true,
          images: true,
        },
      });

      return sendResponse(reply, 200, listing);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendResponse(reply, 400, { error: error.errors });
      }
      throw error;
    }
  });

  // Delete listing
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.listing.delete({
      where: { id: parseInt(id) },
    });
    return sendResponse(reply, 200, { success: true });
  });
}
