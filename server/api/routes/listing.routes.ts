import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient, ListingStatus, Prisma } from '@prisma/client';
import {
  createListingSchema,
  updateListingSchema,
  listingQuerySchema,
} from '../schemas/listing.schema';
import { z } from 'zod';
import { verifyAuth0Token } from '../../middleware/auth';
import { config } from '../../config/config';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

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

function sendResponse(reply: any, statusCode: number, data: any) {
  return reply.code(statusCode).send(data);
}

async function getAuthenticatedUser(fastify: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
  const isAuthenticated = await verifyAuth0Token(request, reply);
  if (!isAuthenticated || !request.user?.sub) {
    return null;
  }

  const user = await fastify.prisma.user.findUnique({
    where: { userId: request.user.sub },
  });

  if (!user) {
    reply.code(404).send({ error: 'User not found' });
    return null;
  }

  return user;
}

async function getOwnedListing(fastify: FastifyInstance, request: FastifyRequest, reply: FastifyReply, listingId: number) {
  const user = await getAuthenticatedUser(fastify, request, reply);
  if (!user) {
    return null;
  }

  const listing = await fastify.prisma.listing.findUnique({
    where: { id: listingId },
    include: { images: true },
  });

  if (!listing) {
    reply.code(404).send({ error: 'Listing not found' });
    return null;
  }

  if (listing.userId !== user.id) {
    reply.code(403).send({ error: 'Access denied. You do not own this listing.' });
    return null;
  }

  return { user, listing };
}

export async function listingRoutes(fastify: FastifyInstance) {
  // Create a new listing (in draft status)
  fastify.post('/', async (request, reply) => {
    try {
      const isAuthenticated = await verifyAuth0Token(request, reply);
      if (!isAuthenticated || !request.user?.sub) {
        return;
      }

      const data = createListingSchema.parse(request.body);
      const authUserId = request.user.sub;

      // Check if user exists
      let user = await fastify.prisma.user.findUnique({
        where: { userId: authUserId }
      });

      if (!user) {
        // Create user if doesn't exist
        user = await fastify.prisma.user.create({
          data: {
            userId: authUserId,
            email: data.email || undefined,
            phone: data.phone || undefined,
            createdAt: new Date(),
            lastLogin: new Date(),
          }
        });
      }

      const listing = await fastify.prisma.listing.create({
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
      const updatedListing = await fastify.prisma.listing.update({
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
      if (Number.isNaN(listingId)) {
        return sendResponse(reply, 400, { error: 'Invalid listing ID' });
      }

      const owned = await getOwnedListing(fastify, request, reply, listingId);
      if (!owned) {
        return;
      }

      const { listing } = owned;
      if (listing.status !== ListingStatus.DRAFT) {
        return sendResponse(reply, 404, { error: 'Draft listing not found' });
      }

      // Validate that listing has at least one image
      if (!listing.images || listing.images.length === 0) {
        return sendResponse(reply, 400, { error: 'At least one image is required to publish a listing' });
      }

      // Update listing status to active
      const publishedListing = await fastify.prisma.listing.update({
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
        search,
        hasImages
      } = queryParams;

      const minCreatedAt = new Date();
      minCreatedAt.setDate(minCreatedAt.getDate() - config.listing.expiryDays);

      const where: Prisma.listingWhereInput = {
        status: ListingStatus.ACTIVE,
        createdAt: { gte: minCreatedAt },
        ...(categoryId && { categoryId }),
        ...(locationId && { locationId }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { description: { contains: search, mode: Prisma.QueryMode.insensitive } }
          ]
        }),
        ...(hasImages === true && {
          images: {
            some: {}
          }
        })
      };

      // Calculate skip for pagination
      const skip = (page - 1) * limit;

      // Get total count for pagination
      const total = await fastify.prisma.listing.count({ where });

      // Get paginated results with proper sorting
      const listings = await fastify.prisma.listing.findMany({
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
      const user = await getAuthenticatedUser(fastify, request, reply);
      if (!user) {
        return;
      }

      const drafts = await fastify.prisma.listing.findMany({
        where: { status: ListingStatus.DRAFT, userId: user.id },
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

  // Get active and non-expired listings for sitemap generation
  fastify.get('/sitemap', async (request, reply) => {
    try {
      const minCreatedAt = new Date();
      minCreatedAt.setDate(minCreatedAt.getDate() - config.listing.expiryDays);

      const listings = await fastify.prisma.listing.findMany({
        where: {
          status: ListingStatus.ACTIVE,
          createdAt: { gte: minCreatedAt },
        },
        select: {
          slug: true,
          updatedAt: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      return sendResponse(reply, 200, listings);
    } catch (error) {
      fastify.log.error(error);
      return sendResponse(reply, 500, { error: 'Internal Server Error' });
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
        listing = await fastify.prisma.listing.findUnique({
          where: { id: numericId },
          include: {
            category: true,
            location: true,
            images: true,
          },
        });
      } else {
        // If not numeric, treat as slug
        listing = await fastify.prisma.listing.findUnique({
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

      // Check if listing is expired
      const expiryDate = new Date(listing.createdAt);
      expiryDate.setDate(expiryDate.getDate() + config.listing.expiryDays);
      const isExpired = new Date() > expiryDate;

      // If user is authenticated, check if they own the listing
      // If they own it, return full data even if expired
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const authResult = await verifyAuth0Token(request, reply);
        if (!authResult) {
          return;
        }

        if (authResult && request.user) {
          // User is authenticated, check ownership
          const user = await fastify.prisma.user.findUnique({
            where: { userId: request.user.sub },
          });

          if (user && listing.userId === user.id) {
            // User owns the listing, return full data including expiry flag
            return sendResponse(reply, 200, { ...listing, isExpired });
          }
        }
        // If auth failed or user doesn't own listing, continue to return masked data
      }

      // Return masked data for public access or if user doesn't own listing
      // isExpired flag is included so the client can render the appropriate expired UI
      return sendResponse(reply, 200, { ...maskSensitiveData(listing), isExpired });
    } catch (error) {
      console.error('Error fetching listing:', error);
      return sendResponse(reply, 500, { error: 'Internal server error' });
    }
  });

  // Get listing contact information (requires authentication)
  fastify.get('/:id/contact', {
    preHandler: verifyAuth0Token
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const numericId = parseInt(id);
      const listing = await fastify.prisma.listing.findUnique({
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
      if (Number.isNaN(numericId)) {
        return sendResponse(reply, 400, { error: 'Invalid listing ID' });
      }

      const owned = await getOwnedListing(fastify, request, reply, numericId);
      if (!owned) {
        return;
      }

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

      const listing = await fastify.prisma.listing.update({
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
    const listingId = parseInt(id);
    if (Number.isNaN(listingId)) {
      return sendResponse(reply, 400, { error: 'Invalid listing ID' });
    }

    const owned = await getOwnedListing(fastify, request, reply, listingId);
    if (!owned) {
      return;
    }

    await fastify.prisma.listing.delete({
      where: { id: listingId },
    });
    return sendResponse(reply, 200, { success: true });
  });

  // Get listings by userId
  fastify.get('/user/:userId', async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };

      const isAuthenticated = await verifyAuth0Token(request, reply);
      if (!isAuthenticated || !request.user?.sub) {
        return;
      }

      if (request.user.sub !== userId) {
        return sendResponse(reply, 403, { error: 'Access denied. You can only view your own listings.' });
      }
      
      // First find the user
      const user = await fastify.prisma.user.findUnique({
        where: { userId },
      });

      if (!user) {
        return sendResponse(reply, 404, { error: 'User not found' });
      }

      // Then get all listings for this user
      const listings = await fastify.prisma.listing.findMany({
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
