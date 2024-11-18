import { z } from 'zod';

export const uploadSchema = {
  params: {
    type: 'object',
    properties: {
      listingId: { type: 'number' }
    },
    required: ['listingId']
  }
};

export type UploadParams = {
  listingId: number;
};