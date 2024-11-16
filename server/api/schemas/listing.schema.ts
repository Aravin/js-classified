import { z } from 'zod'

const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/

const baseSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  email: z.string().email().max(255).nullish(),
  phone: z.string().max(20).nullish(),
  categoryId: z.number().int().positive(),
  locationId: z.number().int().positive(),
  images: z.array(z.object({
    path: z.string(),
    thumbnailPath: z.string().optional(),
    order: z.number().int().min(0)
  })).optional()
}).superRefine((data, ctx) => {
  // Check if at least one contact method exists
  if (!data.email && !data.phone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one contact method (email or phone) must be provided",
      path: ["contact"]
    });
    return;
  }

  // Validate phone format only if phone is provided
  if (data.phone && !phoneRegex.test(data.phone)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid phone number format",
      path: ["phone"]
    });
  }
})

export const createListingSchema = baseSchema

export const updateListingSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  email: z.string().email().max(255).nullish(),
  phone: z.string().max(20).nullish(),
  categoryId: z.number().int().positive().optional(),
  locationId: z.number().int().positive().optional(),
  status: z.enum(['A', 'E', 'S', 'D']).optional(),
  images: z.array(z.object({
    path: z.string(),
    thumbnailPath: z.string().optional(),
    order: z.number().int().min(0)
  })).optional()
}).superRefine((data, ctx) => {
  // Only validate if either contact method is being updated
  if (data.email !== undefined || data.phone !== undefined) {
    if (!data.email && !data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one contact method (email or phone) must be provided if updating contact information",
        path: ["contact"]
      });
      return;
    }
  }

  // Validate phone format only if phone is being updated
  if (data.phone && !phoneRegex.test(data.phone)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid phone number format",
      path: ["phone"]
    });
  }
})