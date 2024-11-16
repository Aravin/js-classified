import { z } from 'zod'

// Add query parameters schema
export const listingQuerySchema = z.object({
  page: z.string().optional().transform(val => (val ? parseInt(val) : 1)),
  limit: z.string().optional().transform(val => (val ? parseInt(val) : 10)),
  categoryId: z.string().optional().transform(val => (val ? parseInt(val) : undefined)),
  locationId: z.string().optional().transform(val => (val ? parseInt(val) : undefined)),
  sortBy: z.enum(['createdAt', 'price']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'), // Changed from sortOrder to order
  search: z.string().optional(),
  minPrice: z.string().optional().transform(val => (val ? parseInt(val) : undefined)),
  maxPrice: z.string().optional().transform(val => (val ? parseInt(val) : undefined)),
  hasImages: z.string().optional().transform(val => val === 'true') // Transform string 'true'/'false' to boolean
})