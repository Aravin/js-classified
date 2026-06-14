import { FastifyReply } from 'fastify';

export interface ErrorResponseBody {
  error: string;
  message: string;
  details?: string;
}

export function buildErrorResponseBody(error: string, details?: string): ErrorResponseBody {
  return details ? { error, message: error, details } : { error, message: error };
}

export function sendErrorResponse(
  reply: FastifyReply,
  statusCode: number,
  error: string,
  details?: string,
) {
  const body = buildErrorResponseBody(error, details);
  return reply.code(statusCode).send(body);
}