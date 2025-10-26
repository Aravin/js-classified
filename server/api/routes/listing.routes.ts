import { FastifyInstance } from 'fastify';
import { PrismaClient, ListingStatus, Prisma } from '@prisma/client';
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

  // Create a new listing (in draft status)
  fastify.post('/', async (request, reply) => {
    try {
      const data = createListingSchema.parse(request.body);

      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { userId: data.authUserId }
      });

      if (!user) {
        // Create user if doesn't exist
        user = await prisma.user.create({
          data: {
            userId: data.authUserId,
            email: data.email || undefined,
            phone: data.phone || undefined,
            createdAt: new Date(),
            lastLogin: new Date(),
          }
        });
      }

      const listing = await prisma.listing.create({
        data: {
          title: data.title,
          description: data.description,
          price: data.price,
          email: data.email,
          phone: data.phone,
          category: {
            connect: { id: data.categoryId }
          },
          location: {
            connect: { id: data.locationId }
          },
          user: {
            connect: { id: user.id }
          },
          status: ListingStatus.DRAFT,
          slug: 'temp',
          images: data.images ? {
            create: data.images.map(img => ({
              path: img.path,
              thumbnailPath: img.thumbnailPath,
              order: img.order
            }))
          } : undefined
        },
      });

      // Update with proper slug after getting ID
      const updatedListing = await prisma.listing.update({
        where: { id: listing.id },
        data: {
          slug: generateSlug(listing.title, listing.id),
        },
        include: {
          category: true,
          location: true,
          images: true,
        },
      });

      return sendResponse(reply, 201, updatedListing);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendResponse(reply, 400, { error: error.issues });
      }
      return sendResponse(reply, 500, { error: 'Internal Server Error'+ (error as Error).message });
    }
  });

  // Publish a listing (change status from draft to active)
  fastify.patch('/:id/publish', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const listingId = parseInt(id);

      // Check if listing exists and is in draft status
      const listing = await prisma.listing.findFirst({
        where: {
          id: listingId,
          status: ListingStatus.DRAFT,
        },
        include: {
          images: true,
        },
      });

      if (!listing) {
        return sendResponse(reply, 404, { error: 'Draft listing not found' });
      }

      // Validate that listing has at least one image
      if (!listing.images || listing.images.length === 0) {
        return sendResponse(reply, 400, { error: 'At least one image is required to publish a listing' });
      }

      // Update listing status to active
      const publishedListing = await prisma.listing.update({
        where: { id: listingId },
        data: { status: ListingStatus.ACTIVE },
        include: {
          category: true,
          location: true,
          images: true,
        },
      });

      return sendResponse(reply, 200, publishedListing);
    } catch (error) {
      return sendResponse(reply, 500, { error: 'Internal Server Error' });
    }
  });

  // Get all listings (exclude drafts by default)
  fastify.get('/', async (request, reply) => {
    try {
      const queryParams = listingQuerySchema.parse(request.query);
      const { 
        page = 1, 
        limit = 10, 
        categoryId, 
        locationId, 
        sortBy = 'createdAt',
        order = 'desc',
        search
      } = queryParams;

      const where: Prisma.listingWhereInput = {
        status: ListingStatus.ACTIVE,
        ...(categoryId && { categoryId }),
        ...(locationId && { locationId }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { description: { contains: search, mode: Prisma.QueryMode.insensitive } }
          ]
        })
      };

      // Calculate skip for pagination
      const skip = (page - 1) * limit;

      // Get total count for pagination
      const total = await prisma.listing.count({ where });

      // Get paginated results with proper sorting
      const listings = await prisma.listing.findMany({
        where,
        include: {
          category: true,
          location: true,
          images: true,
        },
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      });

      const maskedListings = listings.map(maskSensitiveData);

      return sendResponse(reply, 200, {
        listings: maskedListings,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendResponse(reply, 400, { error: error.issues });
      }
      throw error;
    }
  });

  // Get draft listings
  fastify.get('/drafts', async (request, reply) => {
    try {
      const drafts = await prisma.listing.findMany({
        where: { status: ListingStatus.DRAFT },
        include: {
          category: true,
          location: true,
          images: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return sendResponse(reply, 200, drafts);
    } catch (error) {
      return sendResponse(reply, 500, { error: 'Internal Server Error' });
    }
  });

  // Get single listing
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { showContact } = request.query as { showContact?: string };
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

      // Return unmasked data if showContact=true
      return sendResponse(reply, 200, showContact === 'true' ? listing : maskSensitiveData(listing));
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

      // Prepare update data with proper type handling
      const updateData: Prisma.listingUpdateInput = {
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.price && { price: data.price }),
        ...(data.email && { email: data.email }),
        ...(data.phone && { phone: data.phone }),
        ...(data.categoryId && { category: { connect: { id: data.categoryId } } }),
        ...(data.locationId && { location: { connect: { id: data.locationId } } }),
        ...(data.status && { status: data.status }),
        ...(data.title && { slug: generateSlug(data.title, numericId) }),
        ...(data.images && {
          images: {
            deleteMany: {},
            create: data.images,
          },
        }),
      };

      const listing = await prisma.listing.update({
        where: { id: numericId },
        data: updateData,
        include: {
          category: true,
          location: true,
          images: true,
        },
      });

      return sendResponse(reply, 200, listing);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendResponse(reply, 400, { error: error.issues });
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

  // Get listings by userId
  fastify.get('/user/:userId', async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      
      // First find the user
      const user = await prisma.user.findUnique({
        where: { userId },
      });

      if (!user) {
        return sendResponse(reply, 404, { error: 'User not found' });
      }

      // Then get all listings for this user
      const listings = await prisma.listing.findMany({
        where: { userId: user.id },
        include: {
          category: true,
          location: true,
          images: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return sendResponse(reply, 200, {
        listings: listings.map(maskSensitiveData),
        total: listings.length
      });
    } catch (error) {
      console.error('Error fetching user listings:', error);
      return sendResponse(reply, 500, { error: 'Internal server error' });
    }
  });
}
