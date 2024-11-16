import { z } from 'zod'

const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const baseSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  email: z.string().max(255).optional(),  
  phone: z.string().max(20).optional(),   
  categoryId: z.number().int().positive(),
  locationId: z.number().int().positive(),
  images: z.array(z.object({
    path: z.string(),
    thumbnailPath: z.string().optional(),
    order: z.number().int().min(0)
  })).optional()
}).superRefine((data, ctx) => {
  const emailValue = data.email?.trim() || null;
  const phoneValue = data.phone?.trim() || null;

  // Check if at least one contact method exists
  if (!emailValue && !phoneValue) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one contact method (email or phone) must be provided",
      path: ["contact"]
    });
    return;
  }

  // Validate email format if provided
  if (emailValue && !emailRegex.test(emailValue)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid email format",
      path: ["email"]
    });
  }

  // Validate phone format if provided
  if (phoneValue && !phoneRegex.test(phoneValue)) {
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
  email: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
  categoryId: z.number().int().positive().optional(),
  locationId: z.number().int().positive().optional(),
  status: z.enum(['A', 'E', 'S', 'D']).optional(),
  images: z.array(z.object({
    path: z.string(),
    thumbnailPath: z.string().optional(),
    order: z.number().int().min(0)
  })).optional()
}).superRefine((data, ctx) => {
  if (data.email !== undefined || data.phone !== undefined) {
    const emailValue = data.email?.trim() || null;
    const phoneValue = data.phone?.trim() || null;

    // Check if at least one contact method exists when updating contact info
    if (!emailValue && !phoneValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one contact method (email or phone) must be provided if updating contact information",
        path: ["contact"]
      });
      return;
    }

    // Validate email format if provided
    if (emailValue && !emailRegex.test(emailValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid email format",
        path: ["email"]
      });
    }

    // Validate phone format if provided
    if (phoneValue && !phoneRegex.test(phoneValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid phone number format",
        path: ["phone"]
      });
    }
  }
})

// Add query parameters schema
export const listingQuerySchema = z.object({
  page: z.string().optional().transform(val => (val ? parseInt(val) : 1)),
  limit: z.string().optional().transform(val => (val ? parseInt(val) : 10)),
  categoryId: z.string().optional().transform(val => (val ? parseInt(val) : undefined)),
  locationId: z.string().optional().transform(val => (val ? parseInt(val) : undefined)),
  sortBy: z.enum(['createdAt', 'price']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
  minPrice: z.string().optional().transform(val => (val ? parseInt(val) : undefined)),
  maxPrice: z.string().optional().transform(val => (val ? parseInt(val) : undefined))
})