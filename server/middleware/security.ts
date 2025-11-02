import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * A09 - Security Logging and Monitoring Failures
 * Comprehensive security logging middleware
 */

export interface SecurityEvent {
  type: 'AUTH_ATTEMPT' | 'AUTH_SUCCESS' | 'AUTH_FAILURE' | 'AUTHORIZATION_DENIED' | 
        'RATE_LIMIT_EXCEEDED' | 'INVALID_INPUT' | 'SUSPICIOUS_ACTIVITY' | 'ERROR';
  message: string;
  ip?: string;
  user?: string;
  path?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Log security events
 */
export function logSecurityEvent(
  request: FastifyRequest,
  event: Omit<SecurityEvent, 'ip' | 'path' | 'timestamp'>
): void {
  const securityLog: SecurityEvent = {
    ...event,
    ip: request.ip,
    path: request.url,
    timestamp: new Date().toISOString(),
  };

  // In production, send to logging service
  // For now, log to console with structured format
  console.log(JSON.stringify({
    level: 'security',
    ...securityLog,
  }));
}

/**
 * A03 - Injection: Validate and sanitize inputs middleware
 */
export async function validateInputMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Log large request bodies
  const contentLength = request.headers['content-length'];
  if (contentLength && parseInt(contentLength) > 1024 * 1024) { // > 1MB
    logSecurityEvent(request, {
      type: 'SUSPICIOUS_ACTIVITY',
      message: 'Large request body detected',
      metadata: { contentLength },
    });
  }

  // Check for common injection patterns in URL
  const injectionPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i, // SQL injection
    /(\%3D)|(=)/i,
    /(\w*((\%27)|(\'))(\s|\+)*((\%6F)|o|(\%4F))((\%72)|r|(\%52)))/i,
    /((\%27)|(\'))\s*union/i,
    /exec(\s|\+)+(s|x)p\w+/i,
    /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c/i, // Path traversal
  ];

  const url = request.url;
  if (injectionPatterns.some(pattern => pattern.test(url))) {
    logSecurityEvent(request, {
      type: 'SUSPICIOUS_ACTIVITY',
      message: 'Potential injection attack detected in URL',
      metadata: { url },
    });
    
    reply.code(400).send({ 
      error: 'Invalid request',
      message: 'Suspicious patterns detected in request',
    });
    return;
  }
}

/**
 * A08 - Software and Data Integrity Failures
 * Validate request signatures (if implemented)
 */
export async function validateRequestIntegrity(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Check Content-Type matches body
  const contentType = request.headers['content-type'];
  const hasBody = request.body !== undefined && request.body !== null;

  if (hasBody && contentType && !contentType.includes('application/json')) {
    // Only allow JSON for JSON endpoints
    if (request.url.includes('/api/') || request.url.includes('/listings') || 
        request.url.includes('/users') || request.url.includes('/images')) {
      reply.code(415).send({ error: 'Unsupported Media Type' });
      return;
    }
  }
}

/**
 * Error handler with security logging
 */
export function securityErrorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Log security-relevant errors
  if (error.message.includes('Unauthorized') || 
      error.message.includes('Forbidden') ||
      error.message.includes('Token')) {
    logSecurityEvent(request, {
      type: 'AUTH_FAILURE',
      message: error.message,
      metadata: { error: error.name },
    });
  }

  // Don't expose internal errors in production
  const statusCode = reply.statusCode || 500;
  const response: any = {
    error: statusCode >= 500 ? 'Internal Server Error' : error.message,
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  reply.code(statusCode).send(response);
}


