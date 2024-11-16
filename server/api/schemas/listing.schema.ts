import { z } from 'zod'

const baseSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(20).regex(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/).optional(),
  categoryId: z.number().int().positive(),
  locationId: z.number().int().positive(),
  images: z.array(z.object({
    path: z.string(),
    thumbnailPath: z.string().optional(),
    order: z.number().int().min(0)
  })).optional()
})

const contactValidation = (data: any) => data.email || data.phone

export const createListingSchema = baseSchema.refine(
  contactValidation,
  {
    message: "At least one contact method (email or phone) must be provided",
    path: ["contact"]
  }
)

const updateBase = baseSchema.partial().extend({
  status: z.enum(['A', 'E', 'S', 'D']).optional()
})

export const updateListingSchema = updateBase.refine(
  (data) => !data.email && !data.phone || contactValidation(data),
  {
    message: "At least one contact method (email or phone) must be provided if updating contact information",
    path: ["contact"]
  }
)