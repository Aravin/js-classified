import { FastifyInstance } from 'fastify';
import { PrismaClient, Prisma, ListingStatus } from '@prisma/client';
import {
  createUserSchema,
  updateUserSchema,
  userQuerySchema,
  userListingsQuerySchema,
  CreateUserParams,
  UpdateUserParams,
  UserQueryParams,
  UserListingsQueryParams,
} from '../schemas/user.schema';

const prisma = new PrismaClient();

interface AuthUser {
  sub: string;
}

const userSelect = {
  id: true,
  userId: true,
  username: true,
  email: true,
  phone: true,
  fullName: true,
  avatar: true,
  createdAt: true,
  lastLogin: true,
} as const;


export async function userRoutes(fastify: FastifyInstance) {

  fastify.addHook('preHandler', async (request, reply) => {
    // Ensure CORS headers are set for every response
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  });

  // Create user
  fastify.post('/', {
    schema: {
      body: createUserSchema,
    },
    handler: async (request, reply) => {
      const data = request.body as CreateUserParams;

      try {
        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { userId: data.userId },
        });

        if (existingUser) {
          // Update lastLogin for existing user
          const user = await prisma.user.update({
            where: { userId: data.userId },
            data: {
              lastLogin: new Date(),
            },
            select: userSelect,
          });
          return reply.status(200).send(user);
        }

        // Create new user with current timestamp
        const user = await prisma.user.create({
          data: {
            ...data,
            createdAt: new Date(),
            lastLogin: new Date(),
          },
          select: userSelect,
        });

        return reply.status(201).send(user);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2002') {
            return reply.status(400).send({ 
              message: 'Username, email or phone already registered' 
            });
          }
        }
        throw error;
      }
    },
  });

  // Get all users with pagination and search
  fastify.get('/', {
    schema: {
      querystring: userQuerySchema,
    },
    handler: async (request, reply) => {
      const { page = 1, limit = 10, search } = request.query as UserQueryParams;
      
      const where: Prisma.userWhereInput = search ? {
        OR: [
          { username: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { fullName: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      } : {};

      const skip = (page - 1) * limit;
      const total = await prisma.user.count({ where });
      
      
      const users = await prisma.user.findMany({
        where,
        select: userSelect,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        data: users,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      });
    },
  });

  // Get user by ID
  fastify.get('/:id', {
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = parseInt(id, 10);

      if (isNaN(userId)) {
        return reply.status(400).send({ message: 'Invalid user ID' });
      }

      const user = await prisma.user.findFirst({
        where: { id: userId },
        select: userSelect,
      });

      if (!user) {
        return reply.status(404).send({ message: 'User not found' });
      }

      return reply.send(user);
    },
  });

  // Update user
  fastify.patch('/:id', {
    schema: {
      body: updateUserSchema,
    },
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const updates = request.body as UpdateUserParams;

      try {
        const user = await prisma.user.update({
          where: { userId: id },
          data: updates,
          select: userSelect,
        });

        return reply.send(user);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2002') {
            return reply.status(400).send({ 
              message: 'Username, email or phone already registered' 
            });
          }
          if (error.code === 'P2025') {
            return reply.status(404).send({ message: 'User not found' });
          }
        }
        throw error;
      }
    },
  });

  // Delete user
  fastify.delete('/:id', {
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await prisma.user.delete({
          where: { userId: id },
        });

        return reply.status(204).send();
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2025') {
            return reply.status(404).send({ message: 'User not found' });
          }
        }
        throw error;
      }
    },
  });

  // Get user listings
  fastify.get('/:id/listings', {
    schema: {
      querystring: userListingsQuerySchema,
    },
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { page = 1, limit = 10, status } = request.query as UserListingsQueryParams;

      const user = await prisma.user.findUnique({
        where: { userId: id },
        select: { id: true },
      });

      if (!user) {
        return reply.status(404).send({ message: 'User not found' });
      }

      const where: Prisma.listingWhereInput = {
        userId: user.id,
        ...(status && { status: status as ListingStatus }),
      };

      const skip = (page - 1) * limit;
      const total = await prisma.listing.count({ where });

      const listings = await prisma.listing.findMany({
        where,
        include: {
          category: true,
          location: true,
          images: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      return reply.send({
        data: listings,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      });
    },
  });
}