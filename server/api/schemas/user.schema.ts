import { z } from 'zod';
import { ListingStatus } from '@prisma/client';

const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;

// Base user schema
const userBaseSchema = {
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(phoneRegex).optional(),
  fullName: z.string().min(1).max(255).optional(),
  avatar: z.string().url().optional(),
};

// Schema for creating user
export const createUserSchema = {
  type: 'object',
  properties: {
    userId: { type: 'string' },
    username: { type: 'string', minLength: 3, maxLength: 50 },
    email: { type: 'string', format: 'email' },
    phone: { type: 'string', pattern: phoneRegex.source },
    fullName: { type: 'string', minLength: 1, maxLength: 255 },
    avatar: { type: 'string', format: 'uri' },
  },
  anyOf: [
    { required: ['email'] },
    { required: ['phone'] }
  ]
};

// Schema for updating user
export const updateUserSchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 3, maxLength: 50 },
    email: { type: 'string', format: 'email' },
    phone: { type: 'string', pattern: phoneRegex.source },
    fullName: { type: 'string', minLength: 1, maxLength: 255 },
    avatar: { type: 'string', format: 'uri' },
  },
  additionalProperties: false,
};

// Query parameters for listing users
export const userQuerySchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
    search: { type: 'string' },
  },
};

// Query parameters for user listings
export const userListingsQuerySchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
    status: { type: 'string', enum: Object.values(ListingStatus) },
  },
};

// Zod schemas for type inference
const zodCreateUserSchema = z.object({
  userId: z.string(),
  ...userBaseSchema,
});

const zodUpdateUserSchema = z.object({
  ...userBaseSchema,
}).refine((data) => {
  return Object.keys(data).length > 0;
}, {
  message: "At least one field must be provided for update"
});

const zodUserQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(10),
  search: z.string().optional(),
});

const zodUserListingsQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(10),
  status: z.nativeEnum(ListingStatus).optional(),
});

export type CreateUserParams = z.infer<typeof zodCreateUserSchema>;
export type UpdateUserParams = z.infer<typeof zodUpdateUserSchema>;
export type UserQueryParams = z.infer<typeof zodUserQuerySchema>;
export type UserListingsQueryParams = z.infer<typeof zodUserListingsQuerySchema>;