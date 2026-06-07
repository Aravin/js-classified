import { FastifyPluginAsync } from 'fastify';
import { MultipartFile } from '@fastify/multipart';
import { PrismaClient } from '@prisma/client';
import { ImageService } from '../../services/image.service';
import { uploadSchema, UploadParams } from '../schemas/upload.schema';
import { config } from '../../config/config';
import { verifyAuth0Token } from '../../middleware/auth';
import { validateFile } from '../../middleware/fileValidation';

interface DeleteImagesBody {
  imageIds: number[];
}

// Extend FastifyInstance to include prisma
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

async function verifyListingOwnership(fastify: any, request: any, reply: any, listingId: number) {
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

  const listing = await fastify.prisma.listing.findUnique({
    where: { id: listingId },
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

export const imageRoutes: FastifyPluginAsync = async (fastify) => {
  // Register multipart
  await fastify.register(import('@fastify/multipart'), {
    limits: {
      fileSize: config.upload.maxFileSize,
      files: config.upload.maxFiles
    }
  });

  fastify.post<{
    Params: UploadParams;
  }>('/listings/:listingId/images', {
    schema: {
      params: uploadSchema.params,
      // Remove body schema as it's handled by multipart
    },
    handler: async (request, reply) => {
      try {
        const { listingId } = request.params;

        // Set response timeout
        reply.raw.setTimeout(120000); // 2 minute timeout for the entire request

        const owned = await verifyListingOwnership(fastify, request, reply, listingId);
        if (!owned) {
          return;
        }

        const data = await request.parts();
        const imageUploads: { file: MultipartFile; order: number }[] = [];
        const filePromises: Promise<Buffer>[] = [];
        const orders: number[] = [];

        // Process parts and collect files
        for await (const part of data) {
          if (part.type === 'file' && part.fieldname === 'image') {
            const validation = await validateFile(part);
            if (!validation.valid) {
              return reply.code(400).send({ error: validation.error });
            }

            const order = orders.length;
            orders.push(order);
            imageUploads.push({ file: part, order });
            // Start buffer conversion immediately
            filePromises.push(part.toBuffer());
          }
        }

        if (imageUploads.length === 0) {
          return reply.code(400).send({ error: 'No images uploaded' });
        }

        if (imageUploads.length > config.upload.maxFiles) {
          return reply.code(400).send({ 
            error: `Maximum ${config.upload.maxFiles} files allowed` 
          });
        }

        // Wait for all buffers to be ready
        console.log('Converting files to buffers...');
        const buffers = await Promise.all(filePromises);
        
        // Prepare upload data
        const uploads = buffers.map((buffer, index) => ({
          buffer,
          order: orders[index]
        }));

        console.log('Starting upload process...');
        const uploadedImages = await ImageService.uploadImages(fastify.prisma, uploads, listingId);
        console.log('Upload completed successfully');

        return reply
          .code(200)
          .header('Content-Type', 'application/json')
          .send({
            success: true,
            images: uploadedImages
          });

      } catch (error) {
        console.error('Upload error:', error);
        
        return reply
          .code(500)
          .header('Content-Type', 'application/json')
          .send({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Upload failed' 
          });
      }
    }
  });

  fastify.delete<{
    Params: UploadParams;
    Body: DeleteImagesBody;
  }>('/listings/:listingId/images', {
    schema: {
      params: uploadSchema.params,
      body: {
        type: 'object',
        required: ['imageIds'],
        properties: {
          imageIds: {
            type: 'array',
            items: { type: 'number' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const { listingId } = request.params;
        const { imageIds } = request.body;

        const owned = await verifyListingOwnership(fastify, request, reply, listingId);
        if (!owned) {
          return;
        }

        // Verify images belong to the listing
        const images = await fastify.prisma.image.findMany({
          where: {
            id: { in: imageIds },
            listingId: listingId
          }
        });

        if (images.length !== imageIds.length) {
          return reply.code(400).send({
            success: false,
            error: 'Some images do not belong to this listing'
          });
        }

        await ImageService.deleteImages(fastify.prisma, imageIds);
        
        return {
          success: true,
          message: 'Images deleted successfully'
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete images'
        });
      }
    }
  });
};

export default imageRoutes;
