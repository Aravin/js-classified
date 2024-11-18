import { z } from 'zod';
import { ListingStatus } from '@prisma/client';

const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const baseSchema = z
  .object({
    title: z.string().min(1).max(255),
    description: z.string().min(1),
    price: z.number().min(0).nonnegative(),
    email: z.string().max(255).optional(),
    phone: z.string().max(20).optional(),
    categoryId: z.number().int().positive(),
    locationId: z.number().int().positive(),
    status: z
      .string()
      .transform(val => val.toUpperCase())
      .pipe(z.nativeEnum(ListingStatus))
      .default(ListingStatus.DRAFT),
    images: z
      .array(
        z.object({
          path: z.string(),
          thumbnailPath: z.string().optional(),
          order: z.number().int().min(0),
        }),
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    const emailValue = data.email?.trim() || null;
    const phoneValue = data.phone?.trim() || null;

    // Check if at least one contact method exists
    if (!emailValue && !phoneValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one contact method (email or phone) must be provided',
        path: ['contact'],
      });
      return;
    }

    // Validate email format if provided
    if (emailValue && !emailRegex.test(emailValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid email format',
        path: ['email'],
      });
    }

    // Validate phone format if provided
    if (phoneValue && !phoneRegex.test(phoneValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid phone number format',
        path: ['phone'],
      });
    }
  });

export const createListingSchema = baseSchema;

export const updateListingSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().min(1).optional(),
    price: z.number().min(0).nonnegative().optional(),
    email: z.string().max(255).optional(),
    phone: z.string().max(20).optional(),
    categoryId: z.number().int().positive().optional(),
    locationId: z.number().int().positive().optional(),
    status: z
      .string()
      .transform(val => val.toUpperCase())
      .pipe(z.nativeEnum(ListingStatus))
      .optional(),
    images: z
      .array(
        z.object({
          path: z.string(),
          thumbnailPath: z.string().optional(),
          order: z.number().int().min(0),
        }),
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.email !== undefined || data.phone !== undefined) {
      const emailValue = data.email?.trim() || null;
      const phoneValue = data.phone?.trim() || null;

      // Check if at least one contact method exists when updating contact info
      if (!emailValue && !phoneValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'At least one contact method (email or phone) must be provided if updating contact information',
          path: ['contact'],
        });
        return;
      }

      // Validate email format if provided
      if (emailValue && !emailRegex.test(emailValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid email format',
          path: ['email'],
        });
      }

      // Validate phone format if provided
      if (phoneValue && !phoneRegex.test(phoneValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid phone number format',
          path: ['phone'],
        });
      }
    }
  });

// Query schema for listing search
export const listingQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  locationId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
  sortBy: z.enum(['createdAt', 'price', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  status: z.nativeEnum(ListingStatus).optional(),
});
